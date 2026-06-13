import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Notification Type Enum ─────────────────────────────────────────────────────
export enum NotificationType {
  APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED',
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',
  APPOINTMENT_STATUS_CHANGED = 'APPOINTMENT_STATUS_CHANGED',
  SCHEDULE_CHANGED = 'SCHEDULE_CHANGED',
  LEAVE_REQUESTED = 'LEAVE_REQUESTED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  TEST_ORDERED = 'TEST_ORDERED',
  PATHOLOGY_REPORT_READY = 'PATHOLOGY_REPORT_READY',
}

// ─── Notification Schema ────────────────────────────────────────────────────────
export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @ApiProperty({
    description: 'Reference to recipient User',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: NotificationType.APPOINTMENT_BOOKED,
  })
  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'Appointment Confirmed',
  })
  @Prop({ required: true, trim: true })
  title: string;

  @ApiProperty({
    description: 'Notification message body',
    example: 'Your appointment with Dr. Rahman is confirmed for 2026-06-20.',
  })
  @Prop({ required: true, trim: true })
  message: string;

  @ApiPropertyOptional({
    description: 'Additional data (appointmentId, amounts, etc.)',
    example: { appointmentId: '507f1f77bcf86cd799439011', serialNumber: 5 },
  })
  @Prop({ type: Object, default: {} })
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
    default: false,
  })
  @Prop({ default: false })
  read: boolean;

  @ApiPropertyOptional({
    description: 'Whether an email was sent for this notification',
    example: false,
    default: false,
  })
  @Prop({ default: false })
  emailSent: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Efficient query for unread notifications per user, sorted newest first
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
