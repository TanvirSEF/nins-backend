import { IsOptional, IsMongoId, IsEnum, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { AppointmentStatus } from '../appointment.schema';

export class AppointmentFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: AppointmentStatus,
    example: AppointmentStatus.PENDING,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Filter by doctor ID',
    example: '507f1f77bcf86cd799439012',
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  doctorId?: string;
}
