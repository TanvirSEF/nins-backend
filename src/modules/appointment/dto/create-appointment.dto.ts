import { IsMongoId, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Doctor profile ID to book appointment with',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({
    description: 'Schedule ID (the shift to book)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  scheduleId: string;

  @ApiProperty({
    description: 'Appointment date (ISO 8601)',
    example: '2026-06-15',
  })
  @IsDateString()
  appointmentDate: string;
}
