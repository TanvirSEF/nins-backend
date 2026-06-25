import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class HospitalUnitDto {
  @ApiProperty({ description: 'Unit name', example: 'Stroke Unit' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unit code', example: 'STROKE-UNIT' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Department name',
    example: 'Neurology',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Department code (auto-uppercased)',
    example: 'NEURO',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  code: string;

  @ApiPropertyOptional({
    description: 'Department description',
    example: 'Department of Neurology and Neurosciences',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Department image/logo public URL',
    example: 'https://cdn.nins.gov.bd/images/departments/neurology.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Hospital units under this department',
    type: [HospitalUnitDto],
    example: [{ name: 'Stroke Unit', code: 'STROKE-UNIT' }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HospitalUnitDto)
  units?: HospitalUnitDto[];
}
