import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { validate } from './config/env.validation';
import { getDatabaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    MongooseModule.forRootAsync(getDatabaseConfig()),
    UserModule,
  ],
})
export class AppModule {}
