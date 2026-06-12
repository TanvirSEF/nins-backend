import { IsBoolean, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBedStatusDto {
  @ApiProperty({
    description: 'Whether the bed is now occupied',
    example: true,
  })
  @IsBoolean()
  isOccupied: boolean;

  @ApiPropertyOptional({
    description: 'Patient name (required when isOccupied is true)',
    example: 'Rahim Uddin',
  })
  @IsOptional()
  @IsString()
  currentPatientName?: string;
}
