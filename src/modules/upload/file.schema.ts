import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Enums ──────────────────────────────────────────────────────────────────────
export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  FAILED = 'FAILED',
}

export enum FileCategory {
  MEDICAL_REPORT = 'MEDICAL_REPORT',
  PRESCRIPTION = 'PRESCRIPTION',
  PATHOLOGY_RESULT = 'PATHOLOGY_RESULT',
  XRAY = 'XRAY',
  MRI = 'MRI',
  CT_SCAN = 'CT_SCAN',
  OTHER = 'OTHER',
}

// ─── Stored File Schema ─────────────────────────────────────────────────────────
export type StoredFileDocument = HydratedDocument<StoredFile>;

@Schema({ timestamps: true })
export class StoredFile {
  @ApiProperty({
    description: 'Owner of the file (User)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @ApiProperty({
    description: 'Who initiated the upload (User)',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  @ApiProperty({
    description: 'File category',
    enum: FileCategory,
    example: FileCategory.MEDICAL_REPORT,
  })
  @Prop({ type: String, enum: FileCategory, required: true, index: true })
  category: FileCategory;

  @ApiProperty({
    description: 'Original filename from client',
    example: 'blood-test.pdf',
  })
  @Prop({ required: true, trim: true })
  originalName: string;

  @ApiProperty({
    description: 'Object key in R2',
    example: 'uploads/507f1f77.../uuid-blood-test.pdf',
  })
  @Prop({ required: true, unique: true, index: true })
  r2Key: string;

  @ApiProperty({
    description: 'MIME type',
    example: 'application/pdf',
  })
  @Prop({ required: true })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 245678,
  })
  @Prop({ required: true })
  sizeBytes: number;

  @ApiPropertyOptional({
    description: 'Public read URL (R2 public bucket or presigned GET)',
  })
  @Prop()
  publicUrl?: string;

  @ApiProperty({
    description: 'Upload status',
    enum: FileStatus,
    example: FileStatus.PENDING,
    default: FileStatus.PENDING,
  })
  @Prop({
    type: String,
    enum: FileStatus,
    default: FileStatus.PENDING,
    index: true,
  })
  status: FileStatus;

  @ApiPropertyOptional({
    description: 'Date when upload was confirmed',
  })
  @Prop()
  uploadedAt?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);
