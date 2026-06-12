import { IsOptional, IsMongoId, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class DoctorFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by department ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by designation',
    example: 'Professor',
  })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({
    description: 'Filter by specialty (partial match)',
    example: 'Neuro',
  })
  @IsOptional()
  @IsString()
  specialty?: string;
}
