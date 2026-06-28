import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum LeaveType {
  CASUAL = 'CASUAL',
  SICK = 'SICK',
  EMERGENCY = 'EMERGENCY',
  PLANNED = 'PLANNED',
}

// Leave Schema
export type LeaveDocument = HydratedDocument<Leave>;

@Schema({ timestamps: true })
export class Leave {
  @ApiProperty({
    description: 'Reference to DoctorProfile',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'DoctorProfile',
    required: true,
    index: true,
  })
  doctorId: Types.ObjectId;

  @ApiProperty({
    description: 'Doctor User ID (for notifications)',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorUserId: Types.ObjectId;

  @ApiProperty({
    description: 'Leave type',
    enum: LeaveType,
    example: LeaveType.CASUAL,
  })
  @Prop({ type: String, enum: LeaveType, required: true })
  type: LeaveType;

  @ApiProperty({
    description: 'Leave start date',
    example: '2026-06-20',
  })
  @Prop({ required: true })
  startDate: Date;

  @ApiProperty({
    description: 'Leave end date',
    example: '2026-06-22',
  })
  @Prop({ required: true })
  endDate: Date;

  @ApiProperty({
    description: 'Reason for leave',
    example: 'Family function out of city',
  })
  @Prop({ required: true, trim: true })
  reason: string;

  @ApiProperty({
    description: 'Leave status',
    enum: LeaveStatus,
    example: LeaveStatus.PENDING,
    default: LeaveStatus.PENDING,
  })
  @Prop({
    type: String,
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
    index: true,
  })
  status: LeaveStatus;

  @ApiPropertyOptional({
    description: 'Admin who reviewed the request (User)',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @ApiPropertyOptional({ description: 'Date reviewed' })
  @Prop()
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: 'Rejection reason (if rejected)',
    example: 'Insufficient staffing on those dates',
  })
  @Prop({ trim: true })
  rejectionReason?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const LeaveSchema = SchemaFactory.createForClass(Leave);

// Efficient lookup for appointment-booking leave check
LeaveSchema.index({ doctorId: 1, status: 1, startDate: 1 });
