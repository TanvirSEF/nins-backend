import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GalleryCategory } from '../gallery.schema';

export class CreateGalleryDto {
  @ApiProperty({
    description: 'Image title',
    example: 'New MRI Machine Installation',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Image description/caption',
    example: 'State-of-the-art 3T MRI scanner',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Gallery category',
    enum: GalleryCategory,
    example: GalleryCategory.FACILITY,
  })
  @IsOptional()
  @IsEnum(GalleryCategory)
  category?: GalleryCategory;
}

export class UpdateGalleryDto {
  @ApiPropertyOptional({ description: 'Image title' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ description: 'Image description/caption' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Gallery category',
    enum: GalleryCategory,
  })
  @IsOptional()
  @IsEnum(GalleryCategory)
  category?: GalleryCategory;

  @ApiPropertyOptional({ description: 'Whether publicly visible' })
  @IsOptional()
  isActive?: boolean;
}
