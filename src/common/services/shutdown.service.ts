import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);

  constructor(@InjectConnection() private connection: Connection) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.warn(`Shutting down (signal: ${signal})...`);

    if (this.connection.readyState === 1) {
      await this.connection.close();
      this.logger.log('MongoDB connection closed');
    }

    this.logger.log('Shutdown complete');
  }
}
