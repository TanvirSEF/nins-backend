import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from './appointment.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import { Schedule, ScheduleDocument } from '../schedule/schedule.schema';
import {
  Leave,
  LeaveDocument,
  LeaveStatus,
} from '../leave/leave.schema';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentFilterDto } from './dto/appointment-filter.dto';
import { Role, UserDocument } from '../user/user.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payment/payment.schema';
import { SslCommerzService } from '../payment/sslcommerz.service';
import { TicketService } from './ticket.service';
import { ConfigService } from '@nestjs/config';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class AppointmentService {
  private readonly appointmentFee: number;
  private readonly backendUrl: string;

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Schedule.name)
    private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Leave.name)
    private leaveModel: Model<LeaveDocument>,
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private notificationService: NotificationService,
    private sslCommerzService: SslCommerzService,
    private ticketService: TicketService,
    private configService: ConfigService,
  ) {
    this.appointmentFee = parseFloat(
      this.configService.get<string>('APPOINTMENT_FEE', '50'),
    );
    this.backendUrl = this.configService.get<string>('BACKEND_URL')!;
  }

  async createAppointment(
    dto: CreateAppointmentDto,
    patientId: string,
  ): Promise<AppointmentDocument> {
    const doctorObjectId = new Types.ObjectId(dto.doctorId);
    const patientObjectId = new Types.ObjectId(patientId);
    const appointmentDate = new Date(dto.appointmentDate);

    // ─── 1. Validate Doctor Exists ──────────────────────────────────────────
    const doctor = await this.doctorModel.findById(dto.doctorId).exec();
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    // ─── 2. Validate Schedule Exists ────────────────────────────────────────
    const schedule = await this.scheduleModel.findById(dto.scheduleId).exec();
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // ─── 3. Schedule Belongs to This Doctor ─────────────────────────────────
    if (!schedule.doctorId.equals(doctorObjectId)) {
      throw new BadRequestException(
        'Schedule does not belong to this doctor',
      );
    }

    // ─── 4. Day-of-Week Match ───────────────────────────────────────────────
    const requestedDay = appointmentDate.getDay();
    if (requestedDay !== schedule.dayOfWeek) {
      throw new BadRequestException(
        'Doctor is not available on this day',
      );
    }

    // ─── 4b. Doctor Leave Check ────────────────────────────────────────────
    const onLeave = await this.leaveModel
      .findOne({
        doctorId: doctorObjectId,
        status: LeaveStatus.APPROVED,
        startDate: { $lte: this.endOfDay(appointmentDate) },
        endDate: { $gte: this.startOfDay(appointmentDate) },
      })
      .exec();
    if (onLeave) {
      throw new BadRequestException(
        'Doctor is on leave on the selected date. Please choose another date.',
      );
    }

    // ─── 5. Double Ticket Block ────────────────────────────────────────────
    const alreadyBooked = await this.appointmentModel
      .findOne({
        patientId: patientObjectId,
        doctorId: doctorObjectId,
        appointmentDate: {
          $gte: this.startOfDay(appointmentDate),
          $lt: this.endOfDay(appointmentDate),
        },
        status: { $ne: AppointmentStatus.CANCELLED },
      })
      .exec();

    if (alreadyBooked) {
      throw new ConflictException(
        'You already have an active appointment with this doctor on this date',
      );
    }

    // ─── 6. Capacity Check (exclude cancelled) ──────────────────────────────
    const existingCount = await this.appointmentModel
      .countDocuments({
        doctorId: doctorObjectId,
        appointmentDate: {
          $gte: this.startOfDay(appointmentDate),
          $lt: this.endOfDay(appointmentDate),
        },
        status: { $ne: AppointmentStatus.CANCELLED },
      })
      .exec();

    if (existingCount >= schedule.maxPatients) {
      throw new BadRequestException(
        'All booking slots for this date are full',
      );
    }

    // ─── 7. Auto Serial Number ──────────────────────────────────────────────
    const serialNumber = existingCount + 1;

    // ─── 8. Create Appointment ──────────────────────────────────────────────
    const appointment = new this.appointmentModel({
      patientId: patientObjectId,
      doctorId: doctorObjectId,
      scheduleId: new Types.ObjectId(dto.scheduleId),
      appointmentDate,
      serialNumber,
    });
    const saved = await appointment.save();

    // ─── 9. Cache Invalidation ──────────────────────────────────────────────
    await this.invalidateAppointmentCache(patientId, dto.doctorId);

    // ─── 10. Notification: Appointment Booked ────────────────────────────────
    await this.notificationService
      .notify(patientId, NotificationType.APPOINTMENT_BOOKED, {
        doctorName: '',
        designation: doctor.designation,
        appointmentDate: saved.appointmentDate,
        serialNumber: saved.serialNumber,
        appointmentId: String(saved._id),
      })
      .catch(() => null);

    return saved;
  }

  // ─── Combined: Book appointment + initiate payment in one step ───────────────
  async bookWithPayment(
    dto: CreateAppointmentDto,
    userId: string,
  ): Promise<{ appointmentId: string; tranId: string; gatewayPageURL: string }> {
    // 1. Run full booking validation + create PENDING appointment (reuse create)
    const appointment = await this.createAppointment(dto, userId);

    try {
      // 2. Generate transaction ID (existing pattern)
      const tranId = `NINS-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`;

      // 3. Fetch user for customer fields
      const user = await this.appointmentModel.db
        .collection('users')
        .findOne({ _id: new Types.ObjectId(userId) });

      // 4. Create PENDING payment
      const payment = new this.paymentModel({
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        tranId,
        amount: this.appointmentFee,
        currency: 'BDT',
        status: PaymentStatus.PENDING,
      });
      const savedPayment = await payment.save();

      // 5. Build SSLCommerz payload
      const sslData = {
        total_amount: this.appointmentFee,
        currency: 'BDT',
        tran_id: tranId,
        success_url: `${this.backendUrl}/api/payments/callback/success`,
        fail_url: `${this.backendUrl}/api/payments/callback/fail`,
        cancel_url: `${this.backendUrl}/api/payments/callback/cancel`,
        ipn_url: `${this.backendUrl}/api/payments/ipn`,
        product_name: 'Appointment Registration Fee',
        product_category: 'healthcare',
        product_profile: 'general',
        shipping_method: 'NO',
        num_of_item: 1,
        product_amount: this.appointmentFee,
        cus_name: (user as any)?.name || 'Patient',
        cus_email: (user as any)?.email,
        cus_add1: 'NINS Hospital',
        cus_city: 'Dhaka',
        cus_postcode: '1207',
        cus_country: 'Bangladesh',
        cus_phone: (user as any)?.phone || '0000000000',
        value_a: String(appointment._id),
      };

      // 6. Call SSLCommerz init
      const response = await this.sslCommerzService.init(sslData);

      if (response?.status === 'SUCCESS' && response?.GatewayPageURL) {
        savedPayment.sessionKey = response.sessionkey;
        await savedPayment.save();

        return {
          appointmentId: String(appointment._id),
          tranId,
          gatewayPageURL: response.GatewayPageURL,
        };
      }

      // Init failed → rollback appointment + payment
      throw new Error(
        response?.failedreason || 'SSLCommerz init failed',
      );
    } catch (error) {
      // Rollback: delete the appointment + cancel the payment
      try {
        await this.appointmentModel.findByIdAndDelete(appointment._id).exec();
        await this.paymentModel
          .updateOne(
            { appointmentId: appointment._id },
            { status: PaymentStatus.CANCELLED, errorReason: error.message },
          )
          .exec();
      } catch {
        // ignore rollback errors
      }
      throw new BadRequestException(
        `Payment could not be initiated: ${error.message}`,
      );
    }
  }

  // ─── Get appointment ticket PDF (delegates to TicketService) ─────────────────
  async getTicket(
    appointmentId: string,
    userId: string,
    isStaff: boolean,
  ): Promise<Buffer> {
    return this.ticketService.getTicket(appointmentId, userId, isStaff);
  }

  async findMyTickets(
    patientId: string,
    filters: AppointmentFilterDto,
  ): Promise<PaginatedResult<AppointmentDocument>> {
    const { page, limit, status, doctorId } = filters;

    const cacheKey = `appointments:patient:${patientId}:status:${status || 'all'}:doc:${doctorId || 'all'}:page:${page}:limit:${limit}`;

    const cached =
      await this.cacheManager.get<PaginatedResult<AppointmentDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query: any = { patientId: new Types.ObjectId(patientId) };
    if (status) query.status = status;
    if (doctorId) query.doctorId = new Types.ObjectId(doctorId);

    const [appointments, total] = await Promise.all([
      this.appointmentModel
        .find(query)
        .populate('doctorId', 'designation')
        .populate('scheduleId', 'dayOfWeek startTime endTime')
        .sort({ appointmentDate: -1, serialNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.appointmentModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<AppointmentDocument> = {
      data: appointments,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 60);
    return result;
  }

  async findByDoctor(
    doctorId: string,
    date?: string,
  ): Promise<{ doctorId: string; date?: string; appointments: AppointmentDocument[]; totalBooked: number }> {
    const doctorObjectId = new Types.ObjectId(doctorId);
    const query: any = {
      doctorId: doctorObjectId,
      status: { $ne: AppointmentStatus.CANCELLED },
    };

    if (date) {
      const d = new Date(date);
      query.appointmentDate = {
        $gte: this.startOfDay(d),
        $lt: this.endOfDay(d),
      };
    }

    const appointments = await this.appointmentModel
      .find(query)
      .populate('patientId', 'name email phone')
      .populate('scheduleId', 'dayOfWeek startTime endTime')
      .sort({ appointmentDate: -1, serialNumber: 1 })
      .exec();

    return {
      doctorId,
      date,
      appointments,
      totalBooked: appointments.length,
    };
  }

  async findOne(id: string): Promise<AppointmentDocument> {
    const appointment = await this.appointmentModel
      .findById(id)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'designation')
      .populate('scheduleId', 'dayOfWeek startTime endTime')
      .exec();

    if (!appointment) {
      throw new NotFoundException(`Appointment #${id} not found`);
    }
    return appointment;
  }

  async updateStatus(
    id: string,
    dto: UpdateAppointmentDto,
    user: UserDocument,
  ): Promise<AppointmentDocument> {
    const appointment = await this.appointmentModel.findById(id).exec();
    if (!appointment) {
      throw new NotFoundException(`Appointment #${id} not found`);
    }

    // ─── Role-based status transitions ──────────────────────────────────────
    const prevStatus = appointment.status;
    if (user.role === Role.PATIENT) {
      // Patients can only CANCEL their own appointments
      if (!appointment.patientId.equals(user._id)) {
        throw new ForbiddenException('You can only cancel your own appointments');
      }
      if (dto.status !== AppointmentStatus.CANCELLED) {
        throw new ForbiddenException('Patients can only cancel appointments');
      }
    }
    // SUPER_ADMIN and HOSPITAL_STAFF can set any status — no restriction

    appointment.status = dto.status;
    const updated = await appointment.save();

    await this.invalidateAppointmentCache(
      String(appointment.patientId),
      String(appointment.doctorId),
    );

    // ─── Notification: Status Changed / Cancelled ─────────────────────────────
    if (prevStatus !== dto.status) {
      const doctor = await this.doctorModel
        .findById(appointment.doctorId)
        .exec();
      const notifType =
        dto.status === AppointmentStatus.CANCELLED
          ? NotificationType.APPOINTMENT_CANCELLED
          : dto.status === AppointmentStatus.COMPLETED
            ? NotificationType.APPOINTMENT_COMPLETED
            : NotificationType.APPOINTMENT_STATUS_CHANGED;

      await this.notificationService
        .notify(String(appointment.patientId), notifType, {
          doctorName: '',
          designation: doctor?.designation,
          appointmentDate: appointment.appointmentDate,
          serialNumber: appointment.serialNumber,
          status: dto.status,
        })
        .catch(() => null);
    }

    return updated;
  }

  async remove(id: string): Promise<AppointmentDocument> {
    const appointment = await this.appointmentModel
      .findByIdAndDelete(id)
      .exec();
    if (!appointment) {
      throw new NotFoundException(`Appointment #${id} not found`);
    }
    await this.invalidateAppointmentCache(
      String(appointment.patientId),
      String(appointment.doctorId),
    );
    return appointment;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }

  private async invalidateAppointmentCache(
    patientId: string,
    doctorId: string,
  ): Promise<void> {
    const keysToDelete: Promise<any>[] = [];

    // Invalidate patient ticket caches (all status/page combinations)
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        keysToDelete.push(
          this.cacheManager.del(
            `appointments:patient:${patientId}:status:all:doc:all:page:${p}:limit:${l}`,
          ),
        );
      }
    }

    // Invalidate doctor schedule cache
    keysToDelete.push(
      this.cacheManager.del(`schedules:doctor:${doctorId}`),
    );

    await Promise.all(keysToDelete);
  }
}
