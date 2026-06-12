import {
  IsMongoId,
  IsInt,
  Min,
  Max,
  IsString,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Doctor profile ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({
    description: 'Day of week (0=Sunday, 1=Monday, ... 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Shift start time (HH:mm)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^[0-9]{2}:[0-9]{2}$/, {
    message: 'startTime must be in HH:mm format (e.g., 09:00)',
  })
  startTime: string;

  @ApiProperty({
    description: 'Shift end time (HH:mm)',
    example: '13:00',
  })
  @IsString()
  @Matches(/^[0-9]{2}:[0-9]{2}$/, {
    message: 'endTime must be in HH:mm format (e.g., 13:00)',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Maximum patients per shift',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPatients?: number;
}
