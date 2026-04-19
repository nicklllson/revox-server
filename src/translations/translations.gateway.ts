import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { WsJwtAuthGuard } from 'src/auth/guards/ws-jwt-auth.guard';

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

  constructor(private configService: ConfigService) {}

  handleDisconnect(client: Client) {
    const upstream = this.upstreams.get(client);
    if (upstream) {
      upstream.close();
      this.upstreams.delete(client);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('start')
  handleStart(
    @ConnectedSocket() client: Client,
    @MessageBody()
    data: {
      youtube_url: string;
      target_lang: string;
      source_lang?: string;
    },
  ) {
    const user = client.data?.user as { id: string };
    const clientId = `${user.id}-${Date.now()}`;
    const ttsUrl =
      this.configService.get<string>('TTS_WS_URL') ?? 'ws://localhost:8000/ws';
    const upstream = new WebSocket(`${ttsUrl}/${clientId}`);

    upstream.on('open', () => {
      upstream.send(JSON.stringify({ action: 'start', ...data }));
    });

    upstream.on('message', (raw: Buffer, isBinary: boolean) => {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(raw, { binary: isBinary });
    });

    upstream.on('error', (err) => {
      this.logger.error(`TTS upstream error: ${err.message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    upstream.on('close', () => {
      this.upstreams.delete(client);
    });

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
