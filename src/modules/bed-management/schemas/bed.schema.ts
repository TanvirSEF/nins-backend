import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BedType {
  ICU = 'ICU',
  HDU = 'HDU',
}

export type BedDocument = HydratedDocument<Bed>;

@Schema({ timestamps: true })
export class Bed {
  @ApiProperty({
    description: 'Bed number (unique, uppercase)',
    example: 'ICU-01',
  })
  @Prop({ required: true, unique: true, uppercase: true })
  bedNumber: string;

  @ApiProperty({
    description: 'Bed type',
    enum: BedType,
    example: BedType.ICU,
  })
  @Prop({ type: String, enum: BedType, required: true, index: true })
  type: BedType;

  @ApiProperty({
    description: 'Ward name',
    example: 'Neuro-Trauma ICU',
  })
  @Prop({ required: true, trim: true })
  wardName: string;

  @ApiProperty({
    description: 'Whether the bed is currently occupied',
    example: false,
    default: false,
  })
  @Prop({ default: false, index: true })
  isOccupied: boolean;

  @ApiPropertyOptional({
    description: 'Name of the patient currently occupying the bed',
    example: 'Rahim Uddin',
  })
  @Prop({ trim: true })
  currentPatientName?: string;

  @ApiPropertyOptional({
    description: 'Date the patient was admitted to this bed',
  })
  admittedAt?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const BedSchema = SchemaFactory.createForClass(Bed);
