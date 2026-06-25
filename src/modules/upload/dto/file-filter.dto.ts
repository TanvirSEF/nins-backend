import { IsOptional, IsMongoId, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { FileCategory, FileStatus } from '../file.schema';

export class FileFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by owner ID' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: FileCategory,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory;

  @ApiPropertyOptional({ description: 'Filter by status', enum: FileStatus })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;
}
