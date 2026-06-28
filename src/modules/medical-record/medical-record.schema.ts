import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Vitals Sub-Document
export class Vitals {
  @ApiPropertyOptional({ description: 'Blood pressure', example: '120/80' })
  @Prop({ trim: true })
  bloodPressure?: string;

  @ApiPropertyOptional({ description: 'Pulse rate (bpm)', example: 72 })
  @Prop()
  pulse?: number;

  @ApiPropertyOptional({ description: 'Temperature (°F)', example: 98.6 })
  @Prop()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Respiratory rate (breaths/min)',
    example: 18,
  })
  @Prop()
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Oxygen saturation (%)', example: 98 })
  @Prop()
  oxygenSaturation?: number;

  @ApiPropertyOptional({ description: 'Weight (kg)', example: 65 })
  @Prop()
  weight?: number;

  @ApiPropertyOptional({ description: 'Height (cm)', example: 170 })
  @Prop()
  height?: number;
}

export const VitalsSchema = SchemaFactory.createForClass(Vitals);

// Enums
export enum MedicalRecordStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

// Medical Record Schema
export type MedicalRecordDocument = HydratedDocument<MedicalRecord>;

@Schema({ timestamps: true })
export class MedicalRecord {
  @ApiProperty({
    description: 'Reference to the Appointment',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true,
    index: true,
  })
  appointmentId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to Patient (User)',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to DoctorProfile',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'DoctorProfile',
    required: true,
    index: true,
  })
  doctorId: Types.ObjectId;

  @ApiProperty({
    description: "Patient's chief complaint",
    example: 'Severe headache for 3 days',
  })
  @Prop({ required: true, trim: true })
  chiefComplaint: string;

  @ApiPropertyOptional({
    description: 'History of present illness',
    example: 'Headache started 3 days ago, worsens in the morning',
  })
  @Prop({ trim: true })
  presentIllness?: string;

  @ApiPropertyOptional({
    description: 'Past medical history',
    example: 'Hypertension for 5 years, on medication',
  })
  @Prop({ trim: true })
  pastHistory?: string;

  @ApiPropertyOptional({
    description: 'Physical examination findings',
    example: 'GCS 15/15, no focal neurological deficit',
  })
  @Prop({ trim: true })
  examinationFindings?: string;

  @ApiPropertyOptional({ description: 'Patient vitals', type: Vitals })
  @Prop({ type: VitalsSchema })
  vitals?: Vitals;

  @ApiProperty({
    description: 'Diagnoses (primary and differential)',
    example: ['Migraine', 'Tension-type headache'],
    type: [String],
  })
  @Prop({ type: [String], default: [] })
  diagnosis: string[];

  @ApiPropertyOptional({
    description: 'Additional doctor notes',
    example: 'Follow up if symptoms persist after 7 days',
  })
  @Prop({ trim: true })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Follow-up date',
    example: '2026-06-20',
  })
  @Prop()
  followUpDate?: Date;

  @ApiProperty({
    description: 'Record status',
    enum: MedicalRecordStatus,
    example: MedicalRecordStatus.ACTIVE,
    default: MedicalRecordStatus.ACTIVE,
  })
  @Prop({
    type: String,
    enum: MedicalRecordStatus,
    default: MedicalRecordStatus.ACTIVE,
  })
  status: MedicalRecordStatus;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const MedicalRecordSchema = SchemaFactory.createForClass(MedicalRecord);
