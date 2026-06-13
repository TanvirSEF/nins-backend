import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Enums ──────────────────────────────────────────────────────────────────────
export enum PathologyStatus {
  ORDERED = 'ORDERED',
  SAMPLE_COLLECTED = 'SAMPLE_COLLECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TestCategory {
  BLOOD = 'BLOOD',
  IMAGING = 'IMAGING',
  URINE = 'URINE',
  BIOPSY = 'BIOPSY',
  OTHER = 'OTHER',
}

export enum ResultFlag {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  LOW = 'LOW',
}

// ─── Result Value Sub-Document ──────────────────────────────────────────────────
export class ResultValue {
  @ApiProperty({ description: 'Parameter name', example: 'Hemoglobin' })
  @Prop({ required: true, trim: true })
  parameter: string;

  @ApiProperty({ description: 'Measured value', example: '13.5 g/dL' })
  @Prop({ required: true, trim: true })
  value: string;

  @ApiPropertyOptional({
    description: 'Reference range',
    example: '13.0-17.0 g/dL',
  })
  @Prop({ trim: true })
  referenceRange?: string;

  @ApiPropertyOptional({
    description: 'Flag',
    enum: ResultFlag,
    example: ResultFlag.NORMAL,
  })
  @Prop({ type: String, enum: ResultFlag })
  flag?: ResultFlag;
}

export const ResultValueSchema = SchemaFactory.createForClass(ResultValue);

// ─── Pathology Report Schema ────────────────────────────────────────────────────
export type PathologyReportDocument = HydratedDocument<PathologyReport>;

@Schema({ timestamps: true })
export class PathologyReport {
  @ApiProperty({
    description: 'Reference to Patient (User)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to DoctorProfile (who ordered)',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'DoctorProfile',
    required: true,
    index: true,
  })
  doctorId: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Reference to Appointment (optional context)',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({ type: Types.ObjectId, ref: 'Appointment' })
  appointmentId?: Types.ObjectId;

  @ApiProperty({
    description: 'Test name',
    example: 'Complete Blood Count',
  })
  @Prop({ required: true, trim: true })
  testName: string;

  @ApiProperty({
    description: 'Test category',
    enum: TestCategory,
    example: TestCategory.BLOOD,
  })
  @Prop({ type: String, enum: TestCategory, required: true, index: true })
  testCategory: TestCategory;

  @ApiPropertyOptional({
    description: 'Clinical notes / instructions',
    example: 'Fasting required, morning sample',
  })
  @Prop({ trim: true })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Reference to StoredFile (R2-uploaded result)',
    example: '507f1f77bcf86cd799439014',
  })
  @Prop({ type: Types.ObjectId, ref: 'StoredFile' })
  resultFileId?: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Textual summary of findings',
    example: 'All values within normal range',
  })
  @Prop({ trim: true })
  resultSummary?: string;

  @ApiPropertyOptional({
    description: 'Structured result values',
    type: [ResultValue],
    example: [
      { parameter: 'Hemoglobin', value: '13.5', referenceRange: '13.0-17.0', flag: 'NORMAL' },
    ],
  })
  @Prop({ type: [ResultValueSchema], default: [] })
  resultValues?: ResultValue[];

  @ApiProperty({
    description: 'Report status',
    enum: PathologyStatus,
    example: PathologyStatus.ORDERED,
    default: PathologyStatus.ORDERED,
  })
  @Prop({
    type: String,
    enum: PathologyStatus,
    default: PathologyStatus.ORDERED,
    index: true,
  })
  status: PathologyStatus;

  @ApiProperty({ description: 'Date when test was ordered' })
  @Prop({ default: Date.now })
  orderedAt: Date;

  @ApiPropertyOptional({ description: 'Date when sample was collected' })
  @Prop()
  sampleCollectedAt?: Date;

  @ApiPropertyOptional({ description: 'Date when report was completed' })
  @Prop()
  completedAt?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const PathologyReportSchema =
  SchemaFactory.createForClass(PathologyReport);
