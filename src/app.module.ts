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
import { HealthModule } from './modules/health/health.module';
import { ShutdownService } from './common/services/shutdown.service';

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
