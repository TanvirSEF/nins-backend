import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsArray,
  IsDateString,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Vitals DTO
export class VitalsDto {
  @ApiPropertyOptional({ description: 'Blood pressure', example: '120/80' })
  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @ApiPropertyOptional({ description: 'Pulse rate (bpm)', example: 72 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pulse?: number;

  @ApiPropertyOptional({ description: 'Temperature (°F)', example: 98.6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Respiratory rate (breaths/min)',
    example: 18,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  respiratoryRate?: number;

  @ApiPropertyOptional({
    description: 'Oxygen saturation (%)',
    example: 98,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @ApiPropertyOptional({ description: 'Weight (kg)', example: 65 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Height (cm)', example: 170 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;
}

// Create Medical Record DTO
export class CreateMedicalRecordDto {
  @ApiProperty({
    description: 'Appointment ID (must be COMPLETED)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  appointmentId: string;

  @ApiProperty({
    description: "Patient's chief complaint",
    example: 'Severe headache for 3 days',
  })
  @IsString()
  @IsNotEmpty()
  chiefComplaint: string;

  @ApiPropertyOptional({
    description: 'History of present illness',
    example: 'Headache started 3 days ago, worsens in the morning',
  })
  @IsOptional()
  @IsString()
  presentIllness?: string;

  @ApiPropertyOptional({
    description: 'Past medical history',
    example: 'Hypertension for 5 years',
  })
  @IsOptional()
  @IsString()
  pastHistory?: string;

  @ApiPropertyOptional({
    description: 'Physical examination findings',
    example: 'GCS 15/15, no focal neurological deficit',
  })
  @IsOptional()
  @IsString()
  examinationFindings?: string;

  @ApiPropertyOptional({ description: 'Patient vitals', type: VitalsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VitalsDto)
  vitals?: VitalsDto;

  @ApiProperty({
    description: 'Diagnoses list',
    example: ['Migraine', 'Tension-type headache'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  diagnosis: string[];

  @ApiPropertyOptional({
    description: 'Additional doctor notes',
    example: 'Follow up if symptoms persist after 7 days',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Follow-up date',
    example: '2026-06-20',
  })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
