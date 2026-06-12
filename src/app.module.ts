import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validate } from './config/env.validation';
import { getDatabaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { ShutdownService } from './common/services/shutdown.service';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),

    // Database with connection pooling
    MongooseModule.forRootAsync(getDatabaseConfig()),

    // Rate limiting — 100 requests per 60s per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Feature modules
    UserModule,
    HealthModule,
  ],
  // Global throttle guard + shutdown handler
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ShutdownService,
  ],
})
export class AppModule {}
