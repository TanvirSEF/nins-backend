import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis, RedisOptions } from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * WebSocket adapter that fans Socket.IO emits out to ALL backend replicas via
 * Redis pub/sub. Without it, a notification emitted on the replica that
 * handled an HTTP request never reaches a socket connected to a different
 * replica (the backend runs 3 replicas behind a load balancer). It attaches to
 * the single io server NestJS creates, so it covers every namespace,
 * including `/notifications`.
 *
 * Failure is NON-FATAL by design: if Redis is unreachable or the adapter can't
 * attach, the app still boots and serves HTTP + single-instance sockets
 * (graceful degradation). It must never cause a boot-time crash/502 loop —
 * that is exactly what the previous inline attempt did.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private readonly configService: ConfigService;

  constructor(app: INestApplication) {
    super(app);
    this.configService = app.get(ConfigService);
  }

  // Return type mirrors the official NestJS docs (`any`) to stay compatible
  // with the base IoAdapter signature across versions. Visibility is `public`
  // to match the base class declaration in this @nestjs/platform-socket.io.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    try {
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const redisPort =
        Number(this.configService.get<string>('REDIS_PORT')) || 6379;
      const password =
        this.configService.get<string>('REDIS_PASSWORD') || undefined;

      const connection: RedisOptions = {
        host,
        port: redisPort,
        password,
        // Tolerate transient startup hiccups; the adapter is best-effort.
        retryStrategy: (times) => Math.min(times * 200, 2000),
      };

      const pubClient = new Redis(connection);
      const subClient = pubClient.duplicate();

      // Critical: ioredis emits 'error' on connection trouble, and an
      // unhandled 'error' event crashes the Node process. This was the likely
      // cause of the previous boot crash — both clients MUST have a listener.
      pubClient.on('error', (err: Error) =>
        this.logger.warn(`Redis (pub) error: ${err.message}`),
      );
      subClient.on('error', (err: Error) =>
        this.logger.warn(`Redis (sub) error: ${err.message}`),
      );

      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log(
        'Socket.IO Redis adapter attached (multi-instance fan-out)',
      );
    } catch (err) {
      // Never let the adapter break bootstrap — fall back to single-instance.
      this.logger.error(
        `Failed to attach Redis adapter — continuing in single-instance mode: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return server;
  }
}
