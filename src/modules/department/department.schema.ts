import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Hospital Unit Sub-Document ───────────────────────────────────────────────
export class HospitalUnit {
  @ApiProperty({ description: 'Unit name', example: 'Stroke Unit' })
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty({ description: 'Unit code', example: 'STROKE-UNIT' })
  @Prop({ required: true })
  code: string;
}

export const HospitalUnitSchema = SchemaFactory.createForClass(HospitalUnit);

// ─── Department Schema ────────────────────────────────────────────────────────
export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department {
  @ApiProperty({
    description: 'Department name',
    example: 'Neurology',
  })
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @ApiProperty({
    description: 'Department code (auto-uppercased)',
    example: 'NEURO',
  })
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @ApiPropertyOptional({
    description: 'Department description',
    example: 'Department of Neurology and Neurosciences',
  })
  @Prop({ trim: true })
  description?: string;

  @ApiPropertyOptional({
    description: 'Department image/logo public URL',
    example: 'https://cdn.nins.gov.bd/images/departments/neurology.jpg',
  })
  @Prop({ trim: true })
  image?: string;

  @ApiPropertyOptional({
    description: 'Hospital units under this department',
    type: [HospitalUnit],
    example: [
      { name: 'Stroke Unit', code: 'STROKE-UNIT' },
      { name: 'Blue Unit', code: 'BLUE-UNIT' },
    ],
  })
  @Prop({ type: [HospitalUnitSchema] })
  units?: HospitalUnit[];

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
