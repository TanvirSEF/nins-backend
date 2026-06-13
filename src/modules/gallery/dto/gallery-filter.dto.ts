import { IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';
import { GalleryCategory } from '../gallery.schema';

export class GalleryFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: GalleryCategory,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(GalleryCategory)
  category?: GalleryCategory;
}
