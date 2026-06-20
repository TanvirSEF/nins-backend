import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';
import { AppointmentCleanupCron } from './appointment-cleanup.cron';
import { TicketService } from './ticket.service';
import { Appointment, AppointmentSchema } from './appointment.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../doctor/doctor-profile.schema';
import { Schedule, ScheduleSchema } from '../schedule/schedule.schema';
import { User, UserSchema } from '../user/user.schema';
import { Leave, LeaveSchema } from '../leave/leave.schema';
import { Payment, PaymentSchema } from '../payment/payment.schema';
import { Department, DepartmentSchema } from '../department/department.schema';
import { PaymentModule } from '../payment/payment.module';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
  imports: [
    PaymentModule,
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: User.name, schema: UserSchema },
      { name: Leave.name, schema: LeaveSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
  ],
  controllers: [AppointmentController],
  providers: [
    // Dedicated Redis client for prefix-based cache invalidation (SCAN+UNLINK).
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        }),
    },
    AppointmentService,
    TicketService,
    AppointmentCleanupCron,
  ],
  exports: [AppointmentService],
})
export class AppointmentModule {}
