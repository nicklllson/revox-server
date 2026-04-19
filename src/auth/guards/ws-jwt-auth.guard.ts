import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: WebSocket & { upgradeReq: IncomingMessage; data?: any } =
      context.switchToWs().getClient();

    const url = new URL(client.upgradeReq.url!, 'ws://localhost');
    const token =
      url.searchParams.get('token') ??
      client.upgradeReq.headers.authorization?.split(' ')[1];

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      client.data = { user: payload };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
