import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @Prop({ required: true, unique: true })
  email: string;

  @ApiProperty({ description: 'User display name', example: 'John Doe', required: false })
  @Prop()
  name?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt?: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
