import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory } from '../file.schema';

export class RequestUploadDto {
  @ApiProperty({
    description: 'File category',
    enum: FileCategory,
    example: FileCategory.MEDICAL_REPORT,
  })
  @IsEnum(FileCategory)
  category: FileCategory;

  @ApiProperty({
    description: 'Original filename',
    example: 'blood-test.pdf',
  })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiProperty({
    description: 'MIME type',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes (max 50MB)',
    example: 245678,
  })
  @IsNumber()
  @Min(1)
  @Max(50 * 1024 * 1024)
  sizeBytes: number;

  @ApiPropertyOptional({
    description: 'Owner of file (staff can set; patient defaults to self)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  ownerId?: string;
}
