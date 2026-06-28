import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Leave, LeaveDocument, LeaveStatus } from './leave.schema';
import {
  DoctorProfile,
  DoctorProfileDocument,
} from '../doctor/doctor-profile.schema';
import { User, UserDocument, Role } from '../user/user.schema';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from '../appointment/appointment.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.schema';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { LeaveFilterDto } from './dto/leave-filter.dto';

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
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectModel(Leave.name) private leaveModel: Model<LeaveDocument>,
    @InjectModel(DoctorProfile.name)
    private doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    private notificationService: NotificationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Doctor requests leave
  async create(dto: CreateLeaveDto, userId: string): Promise<LeaveDocument> {
    // Resolve doctor profile
    const doctorProfile = await this.doctorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doctorProfile) {
      throw new ForbiddenException('Doctor profile not found');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    // Validate date range
    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping APPROVED or PENDING leave
    const overlapping = await this.leaveModel
      .findOne({
        doctorId: doctorProfile._id,
        status: { $in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      })
      .exec();
    if (overlapping) {
      throw new BadRequestException(
        'An overlapping approved or pending leave already exists for these dates',
      );
    }

    const leave = new this.leaveModel({
      doctorId: doctorProfile._id,
      doctorUserId: new Types.ObjectId(userId),
      type: dto.type,
      startDate,
      endDate,
      reason: dto.reason,
    });
    const saved = await leave.save();

    // Notify all admins/staff about the new leave request
    await this.notifyReviewersOfNewRequest(saved, doctorProfile).catch(
      () => null,
    );

    await this.invalidateLeaveCache();
    return saved;
  }

  // Review (approve/reject)
  async review(
    id: string,
    dto: ReviewLeaveDto,
    reviewerUserId: string,
  ): Promise<LeaveDocument> {
    const leave = await this.leaveModel.findById(id).exec();
    if (!leave) {
      throw new NotFoundException(`Leave #${id} not found`);
    }
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        `Leave has already been ${leave.status.toLowerCase()}`,
      );
    }
    if (dto.status === LeaveStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    leave.status = dto.status;
    leave.reviewedBy = new Types.ObjectId(reviewerUserId);
    leave.reviewedAt = new Date();
    if (dto.status === LeaveStatus.REJECTED) {
      leave.rejectionReason = dto.rejectionReason;
    }
    const updated = await leave.save();

    // Notify the doctor about the decision
    await this.notificationService
      .notify(
        String(leave.doctorUserId),
        dto.status === LeaveStatus.APPROVED
          ? NotificationType.LEAVE_APPROVED
          : NotificationType.LEAVE_REJECTED,
        {
          startDate: leave.startDate,
          endDate: leave.endDate,
          reason: dto.rejectionReason,
        },
      )
      .catch(() => null);

    // If approved, auto-cancel conflicting appointments + notify patients
    if (dto.status === LeaveStatus.APPROVED) {
      await this.cancelConflictingAppointments(leave).catch(() => null);
    }

    await this.invalidateLeaveCache();
    return updated;
  }

  // Doctor updates own PENDING leave
  async update(
    id: string,
    dto: UpdateLeaveDto,
    userId: string,
  ): Promise<LeaveDocument> {
    const leave = await this.leaveModel.findById(id).exec();
    if (!leave) {
      throw new NotFoundException(`Leave #${id} not found`);
    }
    if (!leave.doctorUserId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException(
        'You can only update your own leave requests',
      );
    }
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be updated',
      );
    }

    if (dto.startDate) leave.startDate = new Date(dto.startDate);
    if (dto.endDate) {
      const endDate = new Date(dto.endDate);
      endDate.setUTCHours(23, 59, 59, 999);
      leave.endDate = endDate;
    }
    if (dto.type) leave.type = dto.type;
    if (dto.reason) leave.reason = dto.reason;

    if (leave.endDate < leave.startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const updated = await leave.save();
    await this.invalidateLeaveCache();
    return updated;
  }

  // Cancel / delete
  async remove(
    id: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<LeaveDocument> {
    const leave = await this.leaveModel.findById(id).exec();
    if (!leave) {
      throw new NotFoundException(`Leave #${id} not found`);
    }
    if (!isAdmin && !leave.doctorUserId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException(
        'You can only cancel your own leave requests',
      );
    }

    // If PENDING, hard-delete; otherwise mark CANCELLED (keeps audit trail)
    if (leave.status === LeaveStatus.PENDING) {
      await this.leaveModel.findByIdAndDelete(id).exec();
    } else {
      leave.status = LeaveStatus.CANCELLED;
      await leave.save();
    }

    await this.invalidateLeaveCache();
    return leave;
  }

  // Doctor's own leaves
  async findMyLeaves(
    userId: string,
    filters: LeaveFilterDto,
  ): Promise<PaginatedResult<LeaveDocument>> {
    return this.listLeaves(
      { doctorUserId: new Types.ObjectId(userId), ...this.buildQuery(filters) },
      `leave:doctor-self:${userId}:status:${filters.status || 'all'}:type:${filters.type || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // All leaves (admin/staff)
  async findAll(
    filters: LeaveFilterDto,
  ): Promise<PaginatedResult<LeaveDocument>> {
    return this.listLeaves(
      this.buildQuery(filters),
      `leave:all:doctor:${filters.doctorId || 'all'}:status:${filters.status || 'all'}:type:${filters.type || 'all'}:page:${filters.page}:limit:${filters.limit}`,
      filters,
    );
  }

  // Single leave
  async findOne(id: string): Promise<LeaveDocument> {
    const leave = await this.leaveModel
      .findById(id)
      .populate('doctorId', 'designation')
      .populate('doctorUserId', 'name email')
      .populate('reviewedBy', 'name email')
      .exec();
    if (!leave) {
      throw new NotFoundException(`Leave #${id} not found`);
    }
    return leave;
  }

  // Helper: check if doctor is on leave on a date (used by appointment booking)
  async isDoctorOnLeave(
    doctorId: Types.ObjectId,
    date: Date,
  ): Promise<boolean> {
    const onLeave = await this.leaveModel
      .findOne({
        doctorId,
        status: LeaveStatus.APPROVED,
        startDate: { $lte: date },
        endDate: { $gte: date },
      })
      .exec();
    return !!onLeave;
  }

  // Cancel appointments that fall within the leave range
  private async cancelConflictingAppointments(
    leave: LeaveDocument,
  ): Promise<void> {
    const startOfDay = new Date(leave.startDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(leave.endDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const conflicting = await this.appointmentModel
      .find({
        doctorId: leave.doctorId,
        appointmentDate: { $gte: startOfDay, $lte: endOfDay },
        status: {
          $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      })
      .exec();

    if (!conflicting.length) return;

    this.logger.log(
      `Cancelling ${conflicting.length} appointments due to approved leave ${leave._id}`,
    );

    const notifications = conflicting.map((appt) =>
      (async () => {
        appt.status = AppointmentStatus.CANCELLED;
        await appt.save();
        await this.notificationService
          .notify(
            String(appt.patientId),
            NotificationType.APPOINTMENT_CANCELLED,
            {
              appointmentDate: appt.appointmentDate,
              serialNumber: appt.serialNumber,
              reason: 'Doctor is on leave on the selected date',
            },
          )
          .catch(() => null);
      })(),
    );
    await Promise.all(notifications);
  }

  // Notify admins/staff about a new leave request
  private async notifyReviewersOfNewRequest(
    leave: LeaveDocument,
    doctor: DoctorProfileDocument,
  ): Promise<void> {
    const reviewers = await this.userModel
      .find({
        role: { $in: [Role.SUPER_ADMIN, Role.HOSPITAL_STAFF] },
      })
      .select('_id')
      .exec();

    const notifications = reviewers.map((admin) =>
      this.notificationService
        .notify(String(admin._id), NotificationType.LEAVE_REQUESTED, {
          doctorDesignation: doctor.designation,
          startDate: leave.startDate,
          endDate: leave.endDate,
          leaveType: leave.type,
          leaveId: String(leave._id),
        })
        .catch(() => null),
    );
    await Promise.all(notifications);
  }

  // Helpers
  private buildQuery(filters: LeaveFilterDto): any {
    const query: any = {};
    if (filters.doctorId) query.doctorId = new Types.ObjectId(filters.doctorId);
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    return query;
  }

  private async listLeaves(
    query: any,
    cacheKey: string,
    filters: LeaveFilterDto,
  ): Promise<PaginatedResult<LeaveDocument>> {
    const { page, limit } = filters;
    const cached =
      await this.cacheManager.get<PaginatedResult<LeaveDocument>>(cacheKey);
    if (cached) return cached;

    const [leaves, total] = await Promise.all([
      this.leaveModel
        .find(query)
        .populate('doctorId', 'designation')
        .populate('doctorUserId', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.leaveModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const result: PaginatedResult<LeaveDocument> = {
      data: leaves,
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

  private async invalidateLeaveCache(): Promise<void> {
    const keysToDelete: Promise<any>[] = [];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        for (const st of ['all', ...Object.values(LeaveStatus)]) {
          for (const ty of ['all', ...Object.values(LeaveStatus)]) {
            keysToDelete.push(
              this.cacheManager.del(
                `leave:all:doctor:all:status:${st}:type:${ty}:page:${p}:limit:${l}`,
              ),
            );
          }
        }
      }
    }
    await Promise.all(keysToDelete);
  }
}
