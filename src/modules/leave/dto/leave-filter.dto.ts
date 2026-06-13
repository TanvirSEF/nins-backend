import { IsOptional, IsMongoId, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { LeaveStatus, LeaveType } from '../leave.schema';

export class LeaveFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by doctor ID' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: LeaveStatus })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @ApiPropertyOptional({ description: 'Filter by type', enum: LeaveType })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(LeaveType)
  type?: LeaveType;
}
