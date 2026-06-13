import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorService } from './doctor.service';
import { DoctorProfileController } from './doctor-profile.controller';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from './doctor-profile.schema';
import { Department, DepartmentSchema } from '../department/department.schema';
import { User, UserSchema } from '../user/user.schema';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DoctorProfileController],
  providers: [DoctorService],
  exports: [DoctorService],
})
export class DoctorModule {}
