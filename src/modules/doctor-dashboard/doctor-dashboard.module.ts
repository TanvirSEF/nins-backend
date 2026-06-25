import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { DoctorDashboardController } from './doctor-dashboard.controller';
import {
  Appointment,
  AppointmentSchema,
} from '../appointment/appointment.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctor/doctor-profile.schema';
import {
  MedicalRecord,
  MedicalRecordSchema,
} from '../medical-record/medical-record.schema';
import {
  Prescription,
  PrescriptionSchema,
} from '../prescription/prescription.schema';
import { Department, DepartmentSchema } from '../department/department.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: MedicalRecord.name, schema: MedicalRecordSchema },
      { name: Prescription.name, schema: PrescriptionSchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
  ],
  controllers: [DoctorDashboardController],
  providers: [DoctorDashboardService],
  exports: [DoctorDashboardService],
})
export class DoctorDashboardModule {}
