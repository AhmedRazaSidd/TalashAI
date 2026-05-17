import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    // Usually auth tokens in WS are sent via auth payload or headers
    const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;

    if (!authHeader) {
      throw new WsException('Unauthorized');
    }

    const token = authHeader.split(' ')[1] || authHeader;

    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) throw new Error('JWT_ACCESS_SECRET is not defined');

      const payload = await this.jwtService.verifyAsync(token, { secret });
      // Attach user payload to socket
      client.user = { userId: payload.sub, role: payload.role };
      return true;
    } catch (err) {
      this.logger.error('Invalid WS token', err.message);
      throw new WsException('Unauthorized');
    }
  }
}
