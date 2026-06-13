import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedicalRecordService } from './medical-record.service';
import { MedicalRecordController } from './medical-record.controller';
import {
  MedicalRecord,
  MedicalRecordSchema,
} from './medical-record.schema';
import { Appointment, AppointmentSchema } from '../appointment/appointment.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctor/doctor-profile.schema';
import { User, UserSchema } from '../user/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicalRecord.name, schema: MedicalRecordSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MedicalRecordController],
  providers: [MedicalRecordService],
  exports: [MedicalRecordService],
})
export class MedicalRecordModule {}
