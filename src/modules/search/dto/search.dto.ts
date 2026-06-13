import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export class SearchDto extends PaginationDto {
  @ApiProperty({
    description: 'Search term (name, email, phone, designation, bmdc)',
    example: 'rahim',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  q: string;

  @ApiPropertyOptional({
    description: 'Restrict to a type',
    enum: ['patient', 'doctor', 'appointment'],
    example: 'patient',
  })
  @IsOptional()
  @IsEnum(['patient', 'doctor', 'appointment'])
  type?: 'patient' | 'doctor' | 'appointment';
}
