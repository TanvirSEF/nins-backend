import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ScheduleDocument = HydratedDocument<Schedule>;

@Schema({ timestamps: true })
export class Schedule {
  @ApiProperty({
    description: 'Reference to DoctorProfile',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'DoctorProfile', required: true })
  doctorId: Types.ObjectId;

  @ApiProperty({
    description: 'Day of week (0=Sunday, 1=Monday, ... 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @Prop({ required: true })
  dayOfWeek: number;

  @ApiProperty({
    description: 'Shift start time (HH:mm)',
    example: '09:00',
  })
  @Prop({ required: true })
  startTime: string;

  @ApiProperty({
    description: 'Shift end time (HH:mm)',
    example: '13:00',
  })
  @Prop({ required: true })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Maximum patients per shift',
    example: 30,
    default: 30,
  })
  @Prop({ default: 30 })
  maxPatients: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
