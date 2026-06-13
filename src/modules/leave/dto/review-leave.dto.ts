import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveStatus } from '../leave.schema';

export class ReviewLeaveDto {
  @ApiProperty({
    description: 'Decision',
    enum: [LeaveStatus.APPROVED, LeaveStatus.REJECTED],
    example: LeaveStatus.APPROVED,
  })
  @IsEnum([LeaveStatus.APPROVED, LeaveStatus.REJECTED])
  status: LeaveStatus.APPROVED | LeaveStatus.REJECTED;

  @ApiPropertyOptional({
    description: 'Rejection reason (required if rejecting)',
    example: 'Insufficient staffing on those dates',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
