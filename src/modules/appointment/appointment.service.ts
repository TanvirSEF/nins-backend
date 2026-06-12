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
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentFilterDto } from './dto/appointment-filter.dto';
import { Role, UserDocument } from '../user/user.schema';

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
  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Schedule.name)
    private scheduleModel: Model<ScheduleDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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

    return saved;
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
