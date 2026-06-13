import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface AppointmentEmailData {
  doctorName?: string;
  designation?: string;
  appointmentDate: Date | string;
  serialNumber?: number;
  appointmentId?: string;
  amount?: number;
  tranId?: string;
}

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ||
      'NINS Hospital <onboarding@resend.dev>';
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`Email send failed to ${to}: ${error.message}`);
        return false;
      }
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Email send error to ${to}: ${error.message}`);
      return false;
    }
  }

  async sendAppointmentBooked(
    to: string,
    name: string,
    data: AppointmentEmailData,
  ): Promise<boolean> {
    const dateStr = this.formatDate(data.appointmentDate);
    const subject = 'Appointment Booked - NINS Hospital';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a56db; color: white; padding: 20px; text-align: center;">
          <h1>NINS Hospital</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2>Dear ${name},</h2>
          <p>Your appointment has been booked successfully.</p>
          <div style="background: white; padding: 15px; border-left: 4px solid #1a56db; margin: 15px 0;">
            <p><strong>Doctor:</strong> ${data.designation || ''} ${data.doctorName || ''}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Serial Number:</strong> ${data.serialNumber || 'N/A'}</p>
          </div>
          <p>Please complete your payment to confirm the appointment.</p>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from NINS Hospital. Please do not reply.</p>
        </div>
      </div>
    `;
    return this.send(to, subject, html);
  }

  async sendAppointmentConfirmed(
    to: string,
    name: string,
    data: AppointmentEmailData,
  ): Promise<boolean> {
    const dateStr = this.formatDate(data.appointmentDate);
    const subject = 'Appointment Confirmed - Payment Successful';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #16a34a; color: white; padding: 20px; text-align: center;">
          <h1>NINS Hospital</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2>Dear ${name},</h2>
          <p>Your payment was successful and your appointment is now <strong style="color: #16a34a;">CONFIRMED</strong>.</p>
          <div style="background: white; padding: 15px; border-left: 4px solid #16a34a; margin: 15px 0;">
            <p><strong>Doctor:</strong> ${data.designation || ''} ${data.doctorName || ''}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Serial Number:</strong> ${data.serialNumber || 'N/A'}</p>
            <p><strong>Amount Paid:</strong> ৳${data.amount || 0}</p>
            <p><strong>Transaction ID:</strong> ${data.tranId || 'N/A'}</p>
          </div>
          <p>Please arrive at least 15 minutes before your scheduled time.</p>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from NINS Hospital. Please do not reply.</p>
        </div>
      </div>
    `;
    return this.send(to, subject, html);
  }

  async sendAppointmentCancelled(
    to: string,
    name: string,
    data: AppointmentEmailData,
  ): Promise<boolean> {
    const dateStr = this.formatDate(data.appointmentDate);
    const subject = 'Appointment Cancelled - NINS Hospital';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1>NINS Hospital</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2>Dear ${name},</h2>
          <p>Your appointment has been <strong style="color: #dc2626;">CANCELLED</strong>.</p>
          <div style="background: white; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0;">
            <p><strong>Doctor:</strong> ${data.designation || ''} ${data.doctorName || ''}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Serial Number:</strong> ${data.serialNumber || 'N/A'}</p>
          </div>
          <p>If you did not request this cancellation, please contact the hospital.</p>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from NINS Hospital. Please do not reply.</p>
        </div>
      </div>
    `;
    return this.send(to, subject, html);
  }

  async sendScheduleChanged(
    to: string,
    name: string,
    data: { doctorName?: string; designation?: string; reason?: string },
  ): Promise<boolean> {
    const subject = 'Schedule Update - NINS Hospital';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #d97706; color: white; padding: 20px; text-align: center;">
          <h1>NINS Hospital</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2>Dear ${name},</h2>
          <p>There is an update regarding your appointment with <strong>${data.designation || ''} ${data.doctorName || ''}</strong>.</p>
          <div style="background: white; padding: 15px; border-left: 4px solid #d97706; margin: 15px 0;">
            <p><strong>Reason:</strong> ${data.reason || 'Schedule has been updated.'}</p>
          </div>
          <p>Please log in to your account or contact the hospital to reschedule if needed.</p>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from NINS Hospital. Please do not reply.</p>
        </div>
      </div>
    `;
    return this.send(to, subject, html);
  }
}
