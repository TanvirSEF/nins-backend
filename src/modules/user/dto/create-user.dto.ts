import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
