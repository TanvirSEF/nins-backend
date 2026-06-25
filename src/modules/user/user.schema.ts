import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOSPITAL_STAFF = 'HOSPITAL_STAFF',
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Prop({ required: true, unique: true, trim: true })
  email: string;

  @ApiHideProperty()
  @Prop({ required: true, select: false })
  passwordHash: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.PATIENT,
    default: Role.PATIENT,
  })
  @Prop({ type: String, enum: Role, default: Role.PATIENT })
  role: Role;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+8801700000000',
  })
  @Prop({ trim: true })
  phone?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Defense in depth: never serialize the password hash. `select: false` already
 * excludes it from ordinary query results, but `auth.service` login/register
 * intentionally load it (`+passwordHash`) to verify or store the credential.
 * This toJSON transform guarantees the hash never reaches an HTTP response,
 * regardless of which code path populated it.
 */
UserSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).passwordHash;
    return ret;
  },
});
