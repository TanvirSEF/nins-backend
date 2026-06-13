import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './notification.schema';
import { User, UserDocument } from '../user/user.schema';
import { MailService } from './mail.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationFilterDto } from './dto/notification-filter.dto';

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

// Which notification types also trigger an email
const EMAIL_ELIGIBLE_TYPES: NotificationType[] = [
  NotificationType.APPOINTMENT_BOOKED,
  NotificationType.APPOINTMENT_CONFIRMED,
  NotificationType.APPOINTMENT_CANCELLED,
  NotificationType.SCHEDULE_CHANGED,
  NotificationType.PATHOLOGY_REPORT_READY,
];

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mailService: MailService,
    private gateway: NotificationGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ─── Core: Create + dispatch a notification ────────────────────────────────
  async notify(
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
  ): Promise<NotificationDocument | null> {
    try {
      const { title, message } = this.buildContent(type, data);

      // 1. Persist
      const notification = new this.notificationModel({
        userId: new Types.ObjectId(userId),
        type,
        title,
        message,
        data,
        read: false,
      });
      const saved = await notification.save();

      // 2. Real-time push via WebSocket
      this.gateway.sendToUser(userId, 'notification', {
        _id: saved._id,
        type: saved.type,
        title: saved.title,
        message: saved.message,
        data: saved.data,
        read: saved.read,
        createdAt: saved.createdAt,
      });

      // 3. Email (for eligible types)
      let emailSent = false;
      if (EMAIL_ELIGIBLE_TYPES.includes(type)) {
        const user = await this.userModel.findById(userId).exec();
        if (user?.email) {
          emailSent = await this.dispatchEmail(
            type,
            user.email,
            user.name,
            data,
          );
          if (emailSent) {
            saved.emailSent = true;
            await saved.save();
          }
        }
      }

      // 4. Invalidate unread count cache
      await this.invalidateUnreadCache(userId);

      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to notify user ${userId}: ${error.message}`,
      );
      return null;
    }
  }

  // ─── Build title + message from type ───────────────────────────────────────
  private buildContent(
    type: NotificationType,
    data: Record<string, any>,
  ): { title: string; message: string } {
    const doctorName =
      data.doctorName || data.doctor?.name || 'your doctor';
    const designation = data.designation || data.doctor?.designation || '';
    const dateStr = data.appointmentDate || data.appointment?.appointmentDate;
    const dateDisplay = dateStr
      ? new Date(dateStr).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';
    const serial = data.serialNumber || data.appointment?.serialNumber;

    switch (type) {
      case NotificationType.APPOINTMENT_BOOKED:
        return {
          title: 'Appointment Booked',
          message: `Your appointment with ${designation} ${doctorName}${dateDisplay ? ` on ${dateDisplay}` : ''}${serial ? ` (Serial #${serial})` : ''} has been booked. Please complete payment to confirm.`,
        };
      case NotificationType.APPOINTMENT_CONFIRMED:
        return {
          title: 'Appointment Confirmed',
          message: `Payment successful! Your appointment with ${designation} ${doctorName}${dateDisplay ? ` on ${dateDisplay}` : ''}${serial ? ` (Serial #${serial})` : ''} is now confirmed.`,
        };
      case NotificationType.APPOINTMENT_CANCELLED:
        return {
          title: 'Appointment Cancelled',
          message: `Your appointment with ${designation} ${doctorName}${dateDisplay ? ` on ${dateDisplay}` : ''} has been cancelled.`,
        };
      case NotificationType.APPOINTMENT_COMPLETED:
        return {
          title: 'Visit Completed',
          message: `Your visit with ${designation} ${doctorName} is marked as completed. Thank you for visiting NINS Hospital.`,
        };
      case NotificationType.APPOINTMENT_STATUS_CHANGED:
        return {
          title: 'Appointment Status Updated',
          message: `Your appointment with ${designation} ${doctorName}${dateDisplay ? ` on ${dateDisplay}` : ''} status has been updated to ${data.status || 'updated'}.`,
        };
      case NotificationType.SCHEDULE_CHANGED:
        return {
          title: 'Schedule Updated',
          message: `There is an update regarding your appointment with ${designation} ${doctorName}. ${data.reason || 'Please check your appointments.'}`,
        };
      case NotificationType.LEAVE_REQUESTED:
        return {
          title: 'New Leave Request',
          message: `A leave request has been submitted by ${data.doctorDesignation || 'a doctor'} for ${data.startDate ? new Date(data.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}${data.endDate ? ' - ' + new Date(data.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}. Please review.`,
        };
      case NotificationType.LEAVE_APPROVED:
        return {
          title: 'Leave Approved',
          message: `Your leave request${data.startDate ? ' from ' + new Date(data.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}${data.endDate ? ' to ' + new Date(data.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''} has been approved.`,
        };
      case NotificationType.LEAVE_REJECTED:
        return {
          title: 'Leave Rejected',
          message: `Your leave request has been rejected${data.reason ? ': ' + data.reason : '.'}`,
        };
      case NotificationType.TEST_ORDERED:
        return {
          title: 'New Test Ordered',
          message: `A ${data.testCategory || ''} test "${data.testName || ''}" has been ordered for you. Please visit the pathology department.`,
        };
      case NotificationType.PATHOLOGY_REPORT_READY:
        return {
          title: 'Pathology Report Ready',
          message: `Your ${data.testName || 'pathology'} report is now ready. You can view it in your reports section.`,
        };
      default:
        return {
          title: 'Notification',
          message: 'You have a new notification.',
        };
    }
  }

  // ─── Dispatch the right email template ─────────────────────────────────────
  private async dispatchEmail(
    type: NotificationType,
    to: string,
    name: string,
    data: Record<string, any>,
  ): Promise<boolean> {
    const emailData = {
      doctorName:
        data.doctorName || data.doctor?.name || 'your doctor',
      designation:
        data.designation || data.doctor?.designation || '',
      appointmentDate:
        data.appointmentDate || data.appointment?.appointmentDate,
      serialNumber:
        data.serialNumber || data.appointment?.serialNumber,
      amount: data.amount,
      tranId: data.tranId,
      reason: data.reason,
      testName: data.testName,
      reportId: data.reportId,
    };

    switch (type) {
      case NotificationType.APPOINTMENT_BOOKED:
        return this.mailService.sendAppointmentBooked(to, name, emailData);
      case NotificationType.APPOINTMENT_CONFIRMED:
        return this.mailService.sendAppointmentConfirmed(to, name, emailData);
      case NotificationType.APPOINTMENT_CANCELLED:
        return this.mailService.sendAppointmentCancelled(to, name, emailData);
      case NotificationType.SCHEDULE_CHANGED:
        return this.mailService.sendScheduleChanged(to, name, emailData);
      case NotificationType.PATHOLOGY_REPORT_READY:
        return this.mailService.sendPathologyReportReady(to, name, emailData);
      default:
        return false;
    }
  }

  // ─── List my notifications (paginated + cached) ─────────────────────────────
  async findMyNotifications(
    userId: string,
    filters: NotificationFilterDto,
  ): Promise<PaginatedResult<NotificationDocument>> {
    const { page, limit, read, type } = filters;

    const cacheKey = `notifications:user:${userId}:read:${read === undefined ? 'all' : read}:type:${type || 'all'}:page:${page}:limit:${limit}`;
    const cached =
      await this.cacheManager.get<PaginatedResult<NotificationDocument>>(
        cacheKey,
      );
    if (cached) return cached;

    const query: any = { userId: new Types.ObjectId(userId) };
    if (read !== undefined) query.read = read;
    if (type) query.type = type;

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<NotificationDocument> = {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    await this.cacheManager.set(cacheKey, result, 30);
    return result;
  }

  // ─── Unread count ───────────────────────────────────────────────────────────
  async findUnreadCount(userId: string): Promise<{ count: number }> {
    const cacheKey = `notifications:unread:${userId}`;
    const cached = await this.cacheManager.get<number>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return { count: cached };
    }

    const count = await this.notificationModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        read: false,
      })
      .exec();

    await this.cacheManager.set(cacheKey, count, 30);
    return { count };
  }

  // ─── Mark single as read ────────────────────────────────────────────────────
  async markAsRead(
    id: string,
    userId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }
    if (!notification.userId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('You can only manage your own notifications');
    }

    notification.read = true;
    const updated = await notification.save();
    await this.invalidateUnreadCache(userId);
    return updated;
  }

  // ─── Mark all as read ───────────────────────────────────────────────────────
  async markAllAsRead(userId: string): Promise<{ modified: number }> {
    const result = await this.notificationModel
      .updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { $set: { read: true } },
      )
      .exec();
    await this.invalidateUnreadCache(userId);
    return { modified: result.modifiedCount };
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────
  async remove(id: string, userId: string): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) {
      throw new NotFoundException(`Notification #${id} not found`);
    }
    if (!notification.userId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('You can only delete your own notifications');
    }
    await this.notificationModel.findByIdAndDelete(id).exec();
    await this.invalidateUnreadCache(userId);
    return notification;
  }

  // ─── Cache helpers ──────────────────────────────────────────────────────────
  private async invalidateUnreadCache(userId: string): Promise<void> {
    const keysToDelete: Promise<any>[] = [
      this.cacheManager.del(`notifications:unread:${userId}`),
    ];
    for (let p = 1; p <= 50; p++) {
      for (const l of [10, 25, 50, 100]) {
        for (const r of ['all', 'true', 'false']) {
          keysToDelete.push(
            this.cacheManager.del(
              `notifications:user:${userId}:read:${r}:type:all:page:${p}:limit:${l}`,
            ),
          );
        }
      }
    }
    await Promise.all(keysToDelete);
  }
}
