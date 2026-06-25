import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({ timestamps: true })
export class Appointment {
  @ApiProperty({
    description: 'Reference to Patient (User)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to DoctorProfile',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'DoctorProfile',
    required: true,
    index: true,
  })
  doctorId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to Schedule',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({ type: Types.ObjectId, ref: 'Schedule', required: true })
  scheduleId: Types.ObjectId;

  @ApiProperty({
    description: 'Appointment date',
    example: '2026-06-15',
  })
  @Prop({ required: true })
  appointmentDate: Date;

  @ApiProperty({
    description: 'Auto-assigned serial number for the day',
    example: 1,
  })
  @Prop({ required: true })
  serialNumber: number;

  @ApiProperty({
    description: 'Appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.PENDING,
    default: AppointmentStatus.PENDING,
  })
  @Prop({
    type: String,
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

// Compound index for efficient day-based booking count queries
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1 });

// Race-condition backstops (concurrent bookings) — enforced at the DB layer:
// 1) No duplicate serial number per doctor+day.
AppointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, serialNumber: 1 },
  { unique: true },
);
// 2) No duplicate ACTIVE booking for the same patient+doctor+day (CANCELLED excluded).
AppointmentSchema.index(
  { patientId: 1, doctorId: 1, appointmentDate: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'CANCELLED' } } },
);
