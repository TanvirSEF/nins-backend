import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsArray,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Medicine DTO
export class MedicineDto {
  @ApiProperty({ description: 'Medicine name', example: 'Paracetamol' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Dosage', example: '500mg' })
  @IsString()
  @IsNotEmpty()
  dosage: string;

  @ApiProperty({ description: 'Frequency', example: 'Twice daily' })
  @IsString()
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({ description: 'Duration', example: '7 days' })
  @IsString()
  @IsNotEmpty()
  duration: string;

  @ApiPropertyOptional({
    description: 'Special instructions',
    example: 'After meal',
  })
  @IsOptional()
  @IsString()
  instructions?: string;
}

// Test DTO
export class TestDto {
  @ApiProperty({ description: 'Test name', example: 'Blood CBC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Test instructions',
    example: 'Fasting required',
  })
  @IsOptional()
  @IsString()
  instructions?: string;
}

// Create Prescription DTO
export class CreatePrescriptionDto {
  @ApiProperty({
    description: 'Medical record ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  medicalRecordId: string;

  @ApiProperty({
    description: 'List of prescribed medicines',
    type: [MedicineDto],
    example: [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '7 days',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicineDto)
  medicines: MedicineDto[];

  @ApiPropertyOptional({
    description: 'List of recommended tests',
    type: [TestDto],
    example: [{ name: 'Blood CBC' }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestDto)
  tests?: TestDto[];

  @ApiPropertyOptional({
    description: "Doctor's advice",
    example: ['Bed rest for 3 days'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  advice?: string[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Review after test results',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Next visit date',
    example: '2026-06-20',
  })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;
}
