import { IsOptional, IsMongoId, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { MedicalRecordStatus } from '../medical-record.schema';

export class MedicalRecordFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by patient ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'Filter by doctor ID',
    example: '507f1f77bcf86cd799439012',
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: MedicalRecordStatus,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(MedicalRecordStatus)
  status?: MedicalRecordStatus;
}
