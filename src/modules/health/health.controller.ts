import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as os from 'os';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  async check() {
    const dbStatus =
      this.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Redis check
    let redisStatus = 'unknown';
    try {
      await this.cacheManager.set('health:ping', 'ok', 5);
      const result = await this.cacheManager.get('health:ping');
      redisStatus = result === 'ok' ? 'connected' : 'error';
    } catch {
      redisStatus = 'disconnected';
    }

    // CPU usage
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();
    const memory = process.memoryUsage();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      database: {
        status: dbStatus,
        name: this.connection.name,
        host: this.connection.host,
      },
      cache: {
        status: redisStatus,
        store: 'redis',
      },
      system: {
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model || 'unknown',
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
        loadAvg: os.loadavg().map((v) => v.toFixed(2)),
      },
      process: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        cpuUser: `${(cpuUsage.user / 1000).toFixed(0)}ms`,
        cpuSystem: `${(cpuUsage.system / 1000).toFixed(0)}ms`,
      },
    };
  }
}
