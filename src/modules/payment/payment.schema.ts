import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum PaymentStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Payment Schema
export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  // Core References
  @ApiProperty({
    description: 'Reference to Appointment',
    example: '507f1f77bcf86cd799439011',
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
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId: Types.ObjectId;

  // Transaction Identifiers
  @ApiProperty({
    description: 'Unique transaction ID (UUID v4)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Prop({ required: true, unique: true, index: true })
  tranId: string;

  @ApiPropertyOptional({
    description: 'SSLCommerz validation ID',
    example: '1709162025351ElIuHtUtFReBwE',
  })
  @Prop()
  valId?: string;

  // Amount
  @ApiProperty({
    description: 'Fee amount at initiation (BDT)',
    example: 50,
  })
  @Prop({ required: true })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'BDT',
    default: 'BDT',
  })
  @Prop({ required: true, default: 'BDT' })
  currency: string;

  // Status
  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
    default: PaymentStatus.PENDING,
  })
  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // SSLCommerz Session
  @ApiPropertyOptional({
    description: 'SSLCommerz session key',
  })
  @Prop()
  sessionKey?: string;

  // SSLCommerz Response Fields (populated by IPN)
  @ApiPropertyOptional({
    description: 'Bank transaction ID',
    example: '1709162345070ANJdZV8LyI4cMw',
  })
  @Prop()
  bankTransactionId?: string;

  @ApiPropertyOptional({
    description: 'Card/payment type',
    example: 'VISA-Brac bank',
  })
  @Prop()
  cardType?: string;

  @ApiPropertyOptional({
    description: 'Masked card number',
    example: '418117XXXXXX6675',
  })
  @Prop()
  cardNo?: string;

  @ApiPropertyOptional({
    description: 'Card brand',
    example: 'VISA',
  })
  @Prop()
  cardBrand?: string;

  @ApiPropertyOptional({
    description: 'Card issuer bank',
    example: 'STANDARD CHARTERED BANK',
  })
  @Prop()
  cardIssuer?: string;

  @ApiPropertyOptional({
    description: 'Gateway name',
  })
  @Prop()
  gatewayName?: string;

  @ApiPropertyOptional({
    description: 'Amount credited to store (after charges)',
    example: 48.0,
  })
  @Prop()
  storeAmount?: number;

  @ApiPropertyOptional({
    description: 'Risk level (0=safe, 1=risky)',
    example: '0',
  })
  @Prop()
  riskLevel?: string;

  @ApiPropertyOptional({
    description: 'Error reason (if failed)',
  })
  @Prop()
  errorReason?: string;

  // Timestamps
  @ApiPropertyOptional({
    description: 'Date when payment was confirmed',
  })
  @Prop()
  paidAt?: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
