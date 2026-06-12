import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type DoctorProfileDocument = HydratedDocument<DoctorProfile>;

@Schema({ timestamps: true })
export class DoctorProfile {
  @ApiProperty({
    description: 'Reference to User (must have DOCTOR role)',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @ApiProperty({
    description: 'BMDC registration number',
    example: 'B-12345',
  })
  @Prop({ required: true, unique: true, trim: true })
  bmdcReg: string;

  @ApiProperty({
    description: 'Designation',
    example: 'Professor',
  })
  @Prop({ required: true })
  designation: string;

  @ApiProperty({
    description: 'Department reference',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  departmentId: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Unit reference (embedded unit _id within department)',
    example: '507f191e810c19729de860ea',
  })
  @Prop({ type: Types.ObjectId })
  unitId?: Types.ObjectId;

  @ApiPropertyOptional({
    description: 'Specialties',
    example: ['Neurosurgery', 'Spine Surgery'],
    type: [String],
  })
  @Prop({ type: [String] })
  specialties?: string[];

  @ApiPropertyOptional({
    description: 'Qualifications',
    example: ['MBBS', 'MS (Neurosurgery)', 'FACS'],
    type: [String],
  })
  @Prop({ type: [String] })
  qualifications?: string[];

  @ApiPropertyOptional({
    description: 'Short biography',
    example: 'Dr. Rahman is a renowned neurosurgeon with 20+ years of experience.',
  })
  @Prop({ trim: true })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Availability schedule',
    example: 'Sat-Thu, 9AM-5PM',
  })
  @Prop()
  availability?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
