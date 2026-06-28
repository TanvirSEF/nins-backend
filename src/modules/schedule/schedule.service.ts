import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Schedule, ScheduleDocument } from './schedule.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Schedule.name)
    private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateScheduleDto): Promise<ScheduleDocument> {
    // Validate doctor exists
    const doctor = await this.doctorModel.findById(dto.doctorId).exec();
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    // Prevent duplicate schedule for same doctor + same day
    const existing = await this.scheduleModel
      .findOne({
        doctorId: new Types.ObjectId(dto.doctorId),
        dayOfWeek: dto.dayOfWeek,
      })
      .exec();
    if (existing) {
      throw new ConflictException(
        'Schedule already exists for this doctor on the specified day',
      );
    }

    const schedule = new this.scheduleModel({
      ...dto,
      doctorId: new Types.ObjectId(dto.doctorId),
    });
    const saved = await schedule.save();
    await this.invalidateScheduleCache(dto.doctorId);
    return saved;
  }

  async findByDoctor(doctorId: string): Promise<ScheduleDocument[]> {
    const cacheKey = `schedules:doctor:${doctorId}`;

    const cached = await this.cacheManager.get<ScheduleDocument[]>(cacheKey);
    if (cached) return cached;

    const schedules = await this.scheduleModel
      .find({ doctorId: new Types.ObjectId(doctorId) })
      .sort({ dayOfWeek: 1 })
      .exec();

    if (!schedules.length) {
      // Cache empty result too (short TTL) to avoid repeated DB hits
      await this.cacheManager.set(cacheKey, schedules, 60);
      return schedules;
    }

    await this.cacheManager.set(cacheKey, schedules, 300);
    return schedules;
  }

  async findOne(id: string): Promise<ScheduleDocument> {
    const cacheKey = `schedules:${id}`;
    const cached = await this.cacheManager.get<ScheduleDocument>(cacheKey);
    if (cached) return cached;

    const schedule = await this.scheduleModel.findById(id).exec();
    if (!schedule) {
      throw new NotFoundException(`Schedule #${id} not found`);
    }
    await this.cacheManager.set(cacheKey, schedule, 300);
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto): Promise<ScheduleDocument> {
    // If dayOfWeek or doctorId changes, check for duplicate
    if (dto.dayOfWeek !== undefined || dto.doctorId) {
      const current = await this.scheduleModel.findById(id).exec();
      if (!current) {
        throw new NotFoundException(`Schedule #${id} not found`);
      }

      const checkDoctorId = dto.doctorId
        ? new Types.ObjectId(dto.doctorId)
        : current.doctorId;
      const checkDay = dto.dayOfWeek ?? current.dayOfWeek;

      const duplicate = await this.scheduleModel
        .findOne({
          _id: { $ne: id },
          doctorId: checkDoctorId,
          dayOfWeek: checkDay,
        })
        .exec();
      if (duplicate) {
        throw new ConflictException(
          'Schedule already exists for this doctor on the specified day',
        );
      }
    }

    // Validate new doctorId if provided
    if (dto.doctorId) {
      const doctor = await this.doctorModel.findById(dto.doctorId).exec();
      if (!doctor) {
        throw new NotFoundException('Doctor profile not found');
      }
    }

    const updateData: any = { ...dto };
    if (dto.doctorId) updateData.doctorId = new Types.ObjectId(dto.doctorId);

    const schedule = await this.scheduleModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .exec();
    if (!schedule) {
      throw new NotFoundException(`Schedule #${id} not found`);
    }
    await this.invalidateScheduleCache(String(schedule.doctorId));
    // Notify affected patients about schedule change
    await this.notifyScheduleChange(schedule.doctorId, 'updated');
    return schedule;
  }

  async remove(id: string): Promise<ScheduleDocument> {
    const schedule = await this.scheduleModel.findByIdAndDelete(id).exec();
    if (!schedule) {
      throw new NotFoundException(`Schedule #${id} not found`);
    }
    await this.invalidateScheduleCache(String(schedule.doctorId));
    // Notify affected patients about schedule removal
    await this.notifyScheduleChange(schedule.doctorId, 'cancelled');
    return schedule;
  }

  // Notify affected patients about a schedule change
  private async notifyScheduleChange(
    doctorId: Types.ObjectId,
    reason: string,
  ): Promise<void> {
    try {
      const doctor = await this.doctorModel.findById(doctorId).exec();
      const doctorName = doctor ? '' : ''; // designation used in message
      const designation = doctor?.designation;

      const affectedAppointments = await this.appointmentModel
        .find({
          doctorId,
          status: { $ne: AppointmentStatus.CANCELLED },
        })
        .populate('patientId', 'name email')
        .exec();

      const notifications = affectedAppointments.map((appt: any) =>
        this.notificationService
          .notify(
            String(appt.patientId._id),
            NotificationType.SCHEDULE_CHANGED,
            {
              doctorName,
              designation,
              reason: `Doctor's schedule has been ${reason}.`,
              appointmentDate: appt.appointmentDate,
              serialNumber: appt.serialNumber,
            },
          )
          .catch(() => null),
      );
      await Promise.all(notifications);
    } catch {
      // Notification failures should never break schedule operations
    }
  }

  private async invalidateScheduleCache(doctorId: string): Promise<void> {
    await Promise.all([
      // Doctor-specific schedule cache
      this.cacheManager.del(`schedules:doctor:${doctorId}`),
      // Doctor profile caches (schedule data affects doctor public listing)
      this.cacheManager.del(`doctors:${doctorId}`),
      // Doctor list caches
      this.invalidateDoctorListCache(),
    ]);
  }

  private async invalidateDoctorListCache(): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        keysToDelete.push(
          this.cacheManager.del(
            `doctors:dept:all:desig:all:spec:all:page:${p}:limit:${l}`,
          ),
        );
      }
    }
    await Promise.all(keysToDelete);
  }
}
