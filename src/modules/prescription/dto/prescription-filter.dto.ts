import { IsOptional, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class PrescriptionFilterDto extends PaginationDto {
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
}
