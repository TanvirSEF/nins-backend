import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
// @ts-expect-error — no types available for cache-manager-ioredis
import * as redisStore from 'cache-manager-ioredis';
import { validate } from './config/env.validation';
import { getDatabaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentModule } from './modules/department/department.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { PaymentModule } from './modules/payment/payment.module';
import { BedManagementModule } from './modules/bed-management/bed-management.module';
import { HealthModule } from './modules/health/health.module';
import { MedicalRecordModule } from './modules/medical-record/medical-record.module';
import { PrescriptionModule } from './modules/prescription/prescription.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UploadModule } from './modules/upload/upload.module';
import { PathologyModule } from './modules/pathology/pathology.module';
import { LeaveModule } from './modules/leave/leave.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { ShutdownService } from './common/services/shutdown.service';
import { JwtAuthGuard } from './common/guards';
import { RolesGuard } from './common/guards';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),

    // Redis Cache — optimized for 4 vCPU / 8GB RAM server
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      ttl: 30, // global cache TTL: 30 seconds (fresh data)
    }),

    // Database with connection pooling (100 max, 20 min)
    MongooseModule.forRootAsync(getDatabaseConfig()),

    // Rate limiting — 200 requests per 60s per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 200,
      },
    ]),

    // Feature modules
    AuthModule,
    UserModule,
    DepartmentModule,
    DoctorModule,
    ScheduleModule,
    AppointmentModule,
    PaymentModule,
    BedManagementModule,
    HealthModule,
    MedicalRecordModule,
    PrescriptionModule,
    DashboardModule,
    NotificationModule,
    UploadModule,
    PathologyModule,
    LeaveModule,
    GalleryModule,
  ],
  // Global guards (execution order: throttle → jwt auth → roles)
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    ShutdownService,
  ],
})
export class AppModule {}
