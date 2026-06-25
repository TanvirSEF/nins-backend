import { ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export const getDatabaseConfig = (): MongooseModuleAsyncOptions => ({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('MONGO_URI'),

    // ─── Connection Pool (optimized for 4 vCPU / 8GB RAM) ───
    maxPoolSize: configService.get<number>('DB_POOL_SIZE', 100),
    minPoolSize: configService.get<number>('DB_MIN_POOL_SIZE', 20),
    maxIdleTimeMS: 30000, // close idle connections after 30s

    // ─── Timeout Settings ───
    serverSelectionTimeoutMS: 5000,
    waitQueueTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,

    // ─── Reliability ───
    retryWrites: true,
    heartbeatFrequencyMS: 10000,
    bufferCommands: true,

    // ─── Replica Set ───
    readPreference: configService.get('MONGO_READ_PREFERENCE', 'primary'),

    // ─── Connection Events ───
    connectionFactory: (connection: Connection) => {
      connection.on('connected', () => {
        console.log('MongoDB connected');
      });
      connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
      });
      connection.on('error', (err) => {
        console.error('MongoDB connection error:', err.message);
      });
      return connection;
    },
  }),
});
