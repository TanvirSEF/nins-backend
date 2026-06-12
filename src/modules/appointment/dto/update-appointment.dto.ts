import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '../appointment.schema';

export class UpdateAppointmentDto {
  @ApiProperty({
    description: 'New appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.CANCELLED,
  })
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;
}
