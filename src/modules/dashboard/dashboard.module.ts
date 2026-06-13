import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User, UserSchema } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctor/doctor-profile.schema';
import {
  Department,
  DepartmentSchema,
} from '../department/department.schema';
import {
  Appointment,
  AppointmentSchema,
} from '../appointment/appointment.schema';
import { Bed, BedSchema } from '../bed-management/schemas/bed.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Bed.name, schema: BedSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
