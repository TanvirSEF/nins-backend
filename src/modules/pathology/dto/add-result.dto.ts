import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PathologyStatus,
  ResultFlag,
} from '../pathology-report.schema';

export class ResultValueDto {
  @ApiProperty({ description: 'Parameter name', example: 'Hemoglobin' })
  @IsString()
  parameter: string;

  @ApiProperty({ description: 'Measured value', example: '13.5' })
  @IsString()
  value: string;

  @ApiPropertyOptional({
    description: 'Reference range',
    example: '13.0-17.0',
  })
  @IsOptional()
  @IsString()
  referenceRange?: string;

  @ApiPropertyOptional({
    description: 'Flag',
    enum: ResultFlag,
    example: ResultFlag.NORMAL,
  })
  @IsOptional()
  @IsEnum(ResultFlag)
  flag?: ResultFlag;
}

export class AddResultDto {
  @ApiPropertyOptional({
    description: 'StoredFile ID of uploaded result (must be confirmed)',
    example: '507f1f77bcf86cd799439014',
  })
  @IsOptional()
  @IsMongoId()
  resultFileId?: string;

  @ApiPropertyOptional({
    description: 'Textual summary of findings',
    example: 'All values within normal range',
  })
  @IsOptional()
  @IsString()
  resultSummary?: string;

  @ApiPropertyOptional({
    description: 'Structured result values',
    type: [ResultValueDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultValueDto)
  resultValues?: ResultValueDto[];

  @ApiPropertyOptional({
    description: 'New status (default COMPLETED)',
    enum: PathologyStatus,
    example: PathologyStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(PathologyStatus)
  status?: PathologyStatus;
}
