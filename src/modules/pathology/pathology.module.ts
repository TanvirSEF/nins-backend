import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PathologyReportService } from './pathology-report.service';
import { PathologyReportController } from './pathology-report.controller';
import {
  PathologyReport,
  PathologyReportSchema,
} from './pathology-report.schema';
import { UploadModule } from '../upload/upload.module';
import { StoredFile, StoredFileSchema } from '../upload/file.schema';
import { User, UserSchema } from '../user/user.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctor/doctor-profile.schema';
import { Appointment, AppointmentSchema } from '../appointment/appointment.schema';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      { name: PathologyReport.name, schema: PathologyReportSchema },
      { name: StoredFile.name, schema: StoredFileSchema },
      { name: User.name, schema: UserSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
  ],
  controllers: [PathologyReportController],
  providers: [PathologyReportService],
  exports: [PathologyReportService],
})
export class PathologyModule {}
