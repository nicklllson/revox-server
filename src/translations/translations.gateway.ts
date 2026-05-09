import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageDto } from './dto/message.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from 'generated/prisma/client';

type Client = WebSocket & {
  upgradeReq: IncomingMessage;
  data?: {
    user: unknown;
  };
};

@WebSocketGateway({ path: '/translations', transports: ['websocket'] })
export class TranslationsGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(TranslationsGateway.name);
  private upstreams = new Map<WebSocket, WebSocket>();

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  handleConnection(client: Client, request: IncomingMessage) {
    try {
      client.on('message', (raw) => {
        this.logger.log(`Raw message: ${raw.toString()}`);
      });

      const url = new URL(request.url!, 'ws://localhost');
      const token =
        url.searchParams.get('token') ??
        request.headers.authorization?.split(' ')[1];

      this.logger.log(`Token: ${token?.slice(0, 20)}...`);
      this.logger.log(
        `Secret: ${this.configService.get<string>('JWT_ACCESS_SECRET')}`,
      );

      if (!token) throw new WsException('No token');

      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        },
      );

      this.logger.log(`Payload: ${JSON.stringify(payload)}`);
      client.data = { user: { id: payload.sub, email: payload.email } };
    } catch (e) {
      this.logger.warn(`WS auth error: ${e.message}`);
      client.close(1008, 'Unauthorized');
    }
  }

  handleDisconnect(client: Client) {
    const upstream = this.upstreams.get(client);
    if (upstream) {
      upstream.close();
      this.upstreams.delete(client);
    }
  }

  @SubscribeMessage('start')
  handleStart(
    @ConnectedSocket() client: Client,
    @MessageBody()
    data: {
      videoId: string;
      youtube_url: string;
      target_lang: string;
      source_lang?: string;
    },
  ) {
    this.logger.log(`handleStart called, data: ${JSON.stringify(data)}`);
    const user: User = client.data?.user as User;
    if (!user) {
      client.close(1008, 'Unauthorized');
      return;
    }

    const clientId = `${user.id}-${Date.now()}`;
    const ttsUrl =
      this.configService.get<string>('TTS_WS_URL') ?? 'ws://localhost:8000/ws';
    const upstream = new WebSocket(`${ttsUrl}/${clientId}`);

    upstream.on('open', () => {
      upstream.send(
        JSON.stringify({
          action: 'start',
          youtube_url: data.youtube_url,
          target_lang: data.target_lang,
          source_lang: data.source_lang,
        }),
      );
    });

    upstream.on('message', (raw: Buffer, isBinary: boolean) => {
      void (async () => {
        if (client.readyState !== WebSocket.OPEN) return;

        if (!isBinary) {
          const msg: MessageDto = JSON.parse(raw.toString());
          if (msg.type === 'metadata' && data.videoId) {
            this.logger.log(
              `Saving externalJobId: ${msg.session_id} for video: ${data.videoId}`,
            );
            await this.prisma.video.update({
              where: { id: data.videoId },
              data: { externalJobId: msg.session_id },
            });
          }
        }

        client.send(raw, { binary: isBinary });
      })();
    });

    upstream.on('error', (err) => {
      this.logger.error(`TTS upstream error: ${err.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    upstream.on('close', () => this.upstreams.delete(client));

    this.upstreams.set(client, upstream);
  }

  @SubscribeMessage('playing_chunk')
  handleHeartbeat(
    @ConnectedSocket() client: Client,
    @MessageBody() data: { chunk_id: number; current_time: number },
  ) {
    this.forward(client, { action: 'playing_chunk', ...data });
  }

  @SubscribeMessage('seek')
  handleSeek(
    @ConnectedSocket() client: Client,
    @MessageBody() data: { time: number },
  ) {
    this.forward(client, { action: 'seek', ...data });
  }

  @SubscribeMessage('pause')
  handlePause(@ConnectedSocket() client: Client) {
    this.forward(client, { action: 'pause' });
  }

  @SubscribeMessage('resume')
  handleResume(@ConnectedSocket() client: Client) {
    this.forward(client, { action: 'resume' });
  }

  @SubscribeMessage('stop')
  handleStop(@ConnectedSocket() client: Client) {
    this.forward(client, { action: 'stop' });
  }

  private forward(client: Client, data: object) {
    const upstream = this.upstreams.get(client);
    if (upstream?.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify(data));
    }
  }
}
