import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
} from './appointment.schema';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from '../payment/payment.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.schema';

/**
 * Auto-cancels PENDING appointments that were never paid within 15 minutes.
 * Runs every 5 minutes. This closes the "unpaid slot hoarding" gap.
 */
@Injectable()
export class AppointmentCleanupCron {
  private readonly logger = new Logger(AppointmentCleanupCron.name);
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    private notificationService: NotificationService,
  ) {}

  @Cron('*/5 * * * *')
  async cancelUnpaidAppointments(): Promise<void> {
    const cutoff = new Date(Date.now() - this.WINDOW_MS);

    const staleAppointments = await this.appointmentModel
      .find({
        status: AppointmentStatus.PENDING,
        createdAt: { $lt: cutoff },
      })
      .exec();

    if (staleAppointments.length === 0) return;

    this.logger.log(
      `Found ${staleAppointments.length} stale PENDING appointments to review`,
    );

    for (const appt of staleAppointments) {
      // Check if a VALIDATED (paid) payment exists
      const paid = await this.paymentModel
        .findOne({
          appointmentId: appt._id,
          status: PaymentStatus.VALIDATED,
        })
        .exec();

      if (paid) {
        // Paid — confirm the appointment (in case IPN was missed)
        appt.status = AppointmentStatus.CONFIRMED;
        await appt.save();
        continue;
      }

      // Unpaid — cancel the appointment
      appt.status = AppointmentStatus.CANCELLED;
      await appt.save();

      // Cancel any dangling PENDING payments
      await this.paymentModel
        .updateMany(
          { appointmentId: appt._id, status: PaymentStatus.PENDING },
          { status: PaymentStatus.CANCELLED },
        )
        .exec();

      // Notify the patient (fire-and-forget)
      await this.notificationService
        .notify(
          String(appt.patientId),
          NotificationType.APPOINTMENT_CANCELLED,
          {
            reason: 'Booking expired — payment not completed within 15 minutes',
            appointmentDate: appt.appointmentDate,
            serialNumber: appt.serialNumber,
          },
        )
        .catch(() => null);

      this.logger.log(
        `Auto-cancelled unpaid appointment ${appt._id} (created ${appt.createdAt})`,
      );
    }
  }
}
