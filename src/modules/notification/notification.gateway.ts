import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: '*' },
})
export class NotificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Attach the Redis adapter so emits fan out across ALL replicas. Without it,
   * a notification triggered by an HTTP request on replica A never reaches a
   * socket connected to replica B (the server runs 3 replicas). The same Redis
   * the cache uses is shared by every replica.
   */
  async afterInit(server: Server) {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = Number(this.configService.get<string>('REDIS_PORT')) || 6379;
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    const pubClient = new Redis({ host, port, password });
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('Socket.IO Redis adapter attached (multi-instance fan-out)');
  }

  async handleConnection(client: Socket) {
    try {
      // Token can come from auth object or query string
      let token = client.handshake.auth?.token;
      if (!token && client.handshake.query?.token) {
        token = client.handshake.query.token as string;
      }

      // Strip "Bearer " prefix if present
      if (token && token.startsWith('Bearer ')) {
        token = token.slice(7);
      }

      if (!token) {
        this.logger.warn(`Connection rejected: no token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      client.data.userId = userId;

      // Join user's personal room for targeted notifications
      await client.join(`user:${userId}`);

      this.logger.log(`Client connected: user ${userId}`);
    } catch (error) {
      this.logger.warn(`Connection rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.logger.log(`Client disconnected: user ${client.data.userId}`);
    }
  }

  /**
   * Emit a notification to a specific user's room.
   * Called by NotificationService.
   */
  sendToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
