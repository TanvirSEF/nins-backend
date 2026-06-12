import { ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (): MongooseModuleAsyncOptions => ({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('MONGO_URI'),
  }),
});
