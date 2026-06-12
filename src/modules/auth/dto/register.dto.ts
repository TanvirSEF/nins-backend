import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../user/user.schema';

export const PublicRole = {
  HOSPITAL_STAFF: Role.HOSPITAL_STAFF,
  DOCTOR: Role.DOCTOR,
  PATIENT: Role.PATIENT,
} as const;

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
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
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'User role (defaults to PATIENT. SUPER_ADMIN cannot be created publicly)',
    enum: [Role.HOSPITAL_STAFF, Role.DOCTOR, Role.PATIENT],
    example: Role.PATIENT,
    default: Role.PATIENT,
  })
  @IsOptional()
  @IsEnum(PublicRole)
  role?: Role;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+8801700000000',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
