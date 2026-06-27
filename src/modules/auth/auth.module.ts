import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import {
  RefreshTokenService,
  AUTH_REDIS,
  REFRESH_JWT,
} from './refresh-token.service';
import { User, UserSchema } from '../user/user.schema';
import { durationToSeconds } from '../../common/utils/cookies';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Access-token signer — short-lived, verified by JwtStrategy from the
    // `Authorization: Bearer` header.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // number = seconds (jsonwebtoken treats a numeric expiresIn as a
          // seconds count); durationToSeconds keeps it type-safe vs the `ms`
          // StringValue the lib otherwise demands.
          expiresIn: durationToSeconds(
            configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
          ),
        },
      }),
    }),
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenService,
    // Dedicated Redis client for refresh-token rotation/reuse tracking (mirrors
    // the REDIS_CLIENT provider in AppointmentModule).
    {
      provide: AUTH_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        }),
    },
    // Refresh-token signer — distinct secret + longer expiry than the access token.
    {
      provide: REFRESH_JWT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtService({
          secret: config.get<string>('JWT_REFRESH_SECRET'),
          signOptions: {
            expiresIn: durationToSeconds(
              config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
            ),
          },
        }),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
