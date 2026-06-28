import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Gallery Category Enum
export enum GalleryCategory {
  FACILITY = 'FACILITY',
  EVENT = 'EVENT',
  ACHIEVEMENT = 'ACHIEVEMENT',
  HEALTH_CAMP = 'HEALTH_CAMP',
  OTHER = 'OTHER',
}

// Gallery Item Schema
export type GalleryItemDocument = HydratedDocument<GalleryItem>;

@Schema({ timestamps: true })
export class GalleryItem {
  @ApiProperty({
    description: 'Image title',
    example: 'New MRI Machine Installation',
  })
  @Prop({ required: true, trim: true })
  title: string;

  @ApiPropertyOptional({
    description: 'Image description/caption',
    example: 'State-of-the-art 3T MRI scanner installed in the radiology dept.',
  })
  @Prop({ trim: true })
  description?: string;

  @ApiProperty({
    description: 'Image public URL (R2)',
    example: 'https://cdn.nins.gov.bd/images/gallery/abc.jpg',
  })
  @Prop({ required: true, trim: true })
  imageUrl: string;

  @ApiProperty({
    description: 'R2 object key (for deletion)',
    example: 'images/gallery/uuid.jpg',
  })
  @Prop({ required: true })
  r2Key: string;

  @ApiProperty({
    description: 'Gallery category',
    enum: GalleryCategory,
    example: GalleryCategory.FACILITY,
    default: GalleryCategory.OTHER,
  })
  @Prop({
    type: String,
    enum: GalleryCategory,
    default: GalleryCategory.OTHER,
    index: true,
  })
  category: GalleryCategory;

  @ApiProperty({
    description: 'Who uploaded the image (User)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  uploadedBy?: Types.ObjectId;

  @ApiProperty({
    description: 'Whether the gallery item is publicly visible',
    example: true,
    default: true,
  })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);

GalleryItemSchema.index({ category: 1, isActive: 1, createdAt: -1 });
