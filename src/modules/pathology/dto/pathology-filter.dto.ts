import { IsOptional, IsMongoId, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { PathologyStatus, TestCategory } from '../pathology-report.schema';

export class PathologyFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by doctor ID' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  doctorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: PathologyStatus,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(PathologyStatus)
  status?: PathologyStatus;

  @ApiPropertyOptional({
    description: 'Filter by test category',
    enum: TestCategory,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(TestCategory)
  testCategory?: TestCategory;
}
