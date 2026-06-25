import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Prescription Medicine Sub-Document ─────────────────────────────────────────
export class PrescriptionMedicine {
  @ApiProperty({ description: 'Medicine name', example: 'Paracetamol' })
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty({ description: 'Dosage', example: '500mg' })
  @Prop({ required: true, trim: true })
  dosage: string;

  @ApiProperty({ description: 'Frequency', example: 'Twice daily' })
  @Prop({ required: true, trim: true })
  frequency: string;

  @ApiProperty({ description: 'Duration', example: '7 days' })
  @Prop({ required: true, trim: true })
  duration: string;

  @ApiPropertyOptional({
    description: 'Special instructions',
    example: 'After meal',
  })
  @Prop({ trim: true })
  instructions?: string;
}

export const PrescriptionMedicineSchema =
  SchemaFactory.createForClass(PrescriptionMedicine);

// ─── Prescription Test Sub-Document ─────────────────────────────────────────────
export class PrescriptionTest {
  @ApiProperty({ description: 'Test name', example: 'Blood CBC' })
  @Prop({ required: true, trim: true })
  name: string;

  @ApiPropertyOptional({
    description: 'Test instructions',
    example: 'Fasting required',
  })
  @Prop({ trim: true })
  instructions?: string;
}

export const PrescriptionTestSchema =
  SchemaFactory.createForClass(PrescriptionTest);

// ─── Prescription Schema ────────────────────────────────────────────────────────
export type PrescriptionDocument = HydratedDocument<Prescription>;

@Schema({ timestamps: true })
export class Prescription {
  @ApiProperty({
    description: 'Reference to MedicalRecord',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'MedicalRecord',
    required: true,
    unique: true,
  })
  medicalRecordId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to Appointment',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'Appointment',
    required: true,
    index: true,
  })
  appointmentId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to Patient (User)',
    example: '507f1f77bcf86cd799439013',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  @ApiProperty({
    description: 'Reference to DoctorProfile',
    example: '507f1f77bcf86cd799439014',
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'DoctorProfile',
    required: true,
    index: true,
  })
  doctorId: Types.ObjectId;

  @ApiProperty({
    description: 'List of prescribed medicines',
    type: [PrescriptionMedicine],
    example: [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '7 days',
      },
    ],
  })
  @Prop({ type: [PrescriptionMedicineSchema], default: [] })
  medicines: PrescriptionMedicine[];

  @ApiPropertyOptional({
    description: 'List of recommended tests',
    type: [PrescriptionTest],
    example: [{ name: 'Blood CBC' }, { name: 'MRI Brain' }],
  })
  @Prop({ type: [PrescriptionTestSchema], default: [] })
  tests: PrescriptionTest[];

  @ApiProperty({
    description: "Doctor's advice",
    example: ['Bed rest for 3 days', 'Drink plenty of water'],
    type: [String],
  })
  @Prop({ type: [String], default: [] })
  advice: string[];

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Review after test results',
  })
  @Prop({ trim: true })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Next visit date',
    example: '2026-06-20',
  })
  @Prop()
  nextVisitDate?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription);
