import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '../leave.schema';

export class CreateLeaveDto {
  @ApiProperty({
    description: 'Leave type',
    enum: LeaveType,
    example: LeaveType.CASUAL,
  })
  @IsEnum(LeaveType)
  type: LeaveType;

  @ApiProperty({
    description: 'Leave start date (YYYY-MM-DD)',
    example: '2026-06-20',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Leave end date (YYYY-MM-DD)',
    example: '2026-06-22',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Reason for leave',
    example: 'Family function out of city',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
