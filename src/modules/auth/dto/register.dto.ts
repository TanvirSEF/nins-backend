import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'patient@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'StrongP@ss123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'User display name',
    example: 'Rahim Uddin',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+8801700000000',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
