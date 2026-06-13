import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrescriptionService } from './prescription.service';
import { PrescriptionController } from './prescription.controller';
import {
  Prescription,
  PrescriptionSchema,
} from './prescription.schema';
import {
  MedicalRecord,
  MedicalRecordSchema,
} from '../medical-record/medical-record.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctor/doctor-profile.schema';
import { User, UserSchema } from '../user/user.schema';
import { Appointment, AppointmentSchema } from '../appointment/appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prescription.name, schema: PrescriptionSchema },
      { name: MedicalRecord.name, schema: MedicalRecordSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
  ],
  controllers: [PrescriptionController],
  providers: [PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
