import { ConfigService } from '@nestjs/config';
import { MongooseModuleAsyncOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export const getDatabaseConfig = (): MongooseModuleAsyncOptions => ({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('MONGO_URI'),
    // ─── Connection Pool Settings ───
    maxPoolSize: configService.get<number>('DB_POOL_SIZE', 50),
    minPoolSize: configService.get<number>('DB_MIN_POOL_SIZE', 10),

    // ─── Timeout Settings ───
    serverSelectionTimeoutMS: 5000,
    waitQueueTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,

    // ─── Reliability ───
    retryWrites: true,
    heartbeatFrequencyMS: 10000,
    bufferCommands: true,

    // ─── Replica Set (auto-enabled if URI contains replicaSet param) ───
    readPreference: configService.get('MONGO_READ_PREFERENCE', 'primary') as any,

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
