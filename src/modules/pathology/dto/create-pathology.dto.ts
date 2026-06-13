import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestCategory } from '../pathology-report.schema';

export class CreatePathologyDto {
  @ApiProperty({
    description: 'Patient ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  patientId: string;

  @ApiProperty({
    description: 'Test name',
    example: 'Complete Blood Count',
  })
  @IsString()
  @IsNotEmpty()
  testName: string;

  @ApiProperty({
    description: 'Test category',
    enum: TestCategory,
    example: TestCategory.BLOOD,
  })
  @IsEnum(TestCategory)
  testCategory: TestCategory;

  @ApiPropertyOptional({
    description: 'Clinical notes / instructions',
    example: 'Fasting required',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Appointment ID (optional context)',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsMongoId()
  appointmentId?: string;
}
