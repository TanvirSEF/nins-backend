import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDoctorProfileDto {
  @ApiProperty({
    description: 'User ID (must have DOCTOR role)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({
    description: 'BMDC registration number',
    example: 'B-12345',
  })
  @IsString()
  @IsNotEmpty()
  bmdcReg: string;

  @ApiProperty({
    description: 'Designation',
    example: 'Professor',
  })
  @IsString()
  @IsNotEmpty()
  designation: string;

  @ApiProperty({
    description: 'Department ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  departmentId: string;

  @ApiPropertyOptional({
    description: 'Unit ID (embedded unit _id within department)',
  })
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Specialties',
    example: ['Neurosurgery', 'Spine Surgery'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({
    description: 'Qualifications',
    example: ['MBBS', 'MS (Neurosurgery)'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];

  @ApiPropertyOptional({
    description: 'Short biography',
    example: 'Dr. Rahman is a renowned neurosurgeon.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Availability schedule',
    example: 'Sat-Thu, 9AM-5PM',
  })
  @IsOptional()
  @IsString()
  availability?: string;
}
