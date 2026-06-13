import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { NotificationType } from '../notification.schema';

export class NotificationFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by read status',
    example: false,
  })
  @Transform(({ value }) => {
    if (value === '' || value === undefined) return undefined;
    return value === 'true' || value === true;
  })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationType,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
