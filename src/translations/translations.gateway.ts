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
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import {
  estimateCreditsForVideo,
  getCreditsPerMinute,
} from 'src/config/credits';

type Client = WebSocket & {
  upgradeReq: IncomingMessage;
  data?: {
    user: unknown;
  };
};

type PlaybackTracking = {
  userId: string;
  chunkDurationSec: number;
  creditsPerMinute: number;
  chargedChunks: Set<number>;
};

@WebSocketGateway({ path: '/translations', transports: ['websocket'] })
export class TranslationsGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(TranslationsGateway.name);
  private upstreams = new Map<WebSocket, WebSocket>();
  private playbackTracking = new Map<WebSocket, PlaybackTracking>();

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  handleConnection(client: Client, request: IncomingMessage) {
    try {
      const url = new URL(request.url!, 'ws://localhost');
      const token =
        url.searchParams.get('token') ??
        request.headers.authorization?.split(' ')[1];

      if (!token) throw new WsException('No token');

      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
        { secret: this.configService.get<string>('JWT_ACCESS_SECRET') },
      );

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

    const tracking = this.playbackTracking.get(client);
    if (tracking) {
      this.logger.log(
        `[disconnect] user=${tracking.userId}, charged ${tracking.chargedChunks.size} chunks`,
      );
      this.playbackTracking.delete(client);
    }
  }

  @SubscribeMessage('start')
  async handleStart(
    @ConnectedSocket() client: Client,
    @MessageBody()
    data: {
      videoId: string;
      youtube_url: string;
      target_lang: string;
      source_lang?: string;
      voice?: {
        gender: 'female' | 'male';
        voice_name?: string;
        style: 'neutral' | 'narrator';
      };
      providers: {
        translator: string;
        tts: string;
        whisper: string;
      };
      pipelineFeatures: {
        multiSpeaker: boolean;
      };
    },
  ) {
    this.logger.log(`handleStart called, data: ${JSON.stringify(data)}`);
    const user: User = client.data?.user as User;
    if (!user) {
      client.close(1008, 'Unauthorized');
      return;
    }

    try {
      await this.checkTierLimits(
        user.id,
        data.videoId,
        data.voice,
        data.providers,
        data.pipelineFeatures,
      );
    } catch (err) {
      this.logger.warn(`Tier check failed for user ${user.id}: ${err.message}`);
      this.sendError(client, err.message);
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
          voice: data.voice,
          providers: data.providers,
          pipeline_features: data.pipelineFeatures,
        }),
      );
    });

    upstream.on('message', (raw: Buffer, isBinary: boolean) => {
      void (async () => {
        if (client.readyState !== WebSocket.OPEN) return;

        if (!isBinary) {
          const msg: MessageDto = JSON.parse(raw.toString());

          if (msg.type === 'metadata' && data.videoId) {
            await this.prisma.video.update({
              where: { id: data.videoId },
              data: { externalJobId: msg.session_id },
            });
          }

          if (msg.type === 'metadata' && msg.total_duration) {
            const creditsPerMinute = getCreditsPerMinute(data.providers, {
              multiSpeaker: data.pipelineFeatures.multiSpeaker,
            });

            this.playbackTracking.set(client, {
              userId: user.id,
              chunkDurationSec: msg.chunk_duration ?? 30,
              creditsPerMinute,
              chargedChunks: new Set(),
            });

            this.logger.log(
              `[tracking init] user=${user.id}, ` +
                `credits/min=${creditsPerMinute.toFixed(2)}, ` +
                `providers=${JSON.stringify(data.providers)}`,
            );
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
  async handleHeartbeat(
    @ConnectedSocket() client: Client,
    @MessageBody() data: { chunk_id: number; current_time: number },
  ) {
    this.forward(client, { action: 'playing_chunk', ...data });

    const tracking = this.playbackTracking.get(client);
    if (!tracking) return;

    if (tracking.chargedChunks.has(data.chunk_id)) return;
    tracking.chargedChunks.add(data.chunk_id);

    const chunkCredits =
      (tracking.chunkDurationSec / 60) * tracking.creditsPerMinute;

    try {
      await this.subscriptions.consumeCreditsSilent(
        tracking.userId,
        chunkCredits,
      );
      this.logger.log(
        `[charge] chunk=${data.chunk_id} → ${chunkCredits.toFixed(3)} credits ` +
          `for user ${tracking.userId} (total chunks: ${tracking.chargedChunks.size})`,
      );

      await this.stopIfNoCredits(client, tracking.userId);
    } catch (err) {
      this.logger.error(`Charge failed: ${err.message}`);
    }
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
    this.playbackTracking.delete(client);
  }

  private forward(client: Client, data: object) {
    const upstream = this.upstreams.get(client);
    if (upstream?.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify(data));
    }
  }

  /* Private methods */

  private async checkTierLimits(
    userId: string,
    videoId: string,
    voice: { gender: string; voice_name?: string; style: string } | undefined,
    providers: { translator: string; tts: string; whisper: string },
    features: { multiSpeaker: boolean },
  ): Promise<void> {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { duration: true },
    });

    if (!video?.duration) {
      throw new Error('Video duration is unknown. Try again in a moment.');
    }

    const tierInfo = await this.subscriptions.getCurrentTierInfo(userId);
    const durationMinutes = video.duration / 60;

    if (durationMinutes > tierInfo.config.maxVideoLengthMinutes) {
      throw new Error(
        `Video is ${durationMinutes.toFixed(1)} min long, but ${tierInfo.config.name} plan ` +
          `supports videos up to ${tierInfo.config.maxVideoLengthMinutes} min.`,
      );
    }

    const estimatedCredits = estimateCreditsForVideo(
      video.duration,
      providers,
      features,
    );

    if (estimatedCredits > tierInfo.creditsRemaining) {
      throw new Error(
        `Not enough credits on ${tierInfo.config.name} plan: ` +
          `${tierInfo.creditsRemaining.toFixed(0)} available, ` +
          `up to ${estimatedCredits.toFixed(0)} required for full playback.`,
      );
    }

    if (voice?.voice_name && !this.isDefaultVoice(voice.voice_name)) {
      if (!tierInfo.config.features.voiceSelection) {
        throw new Error(
          `Voice selection is not available on ${tierInfo.config.name} plan.`,
        );
      }
    }
  }

  private isDefaultVoice(voiceName: string): boolean {
    const defaults = ['default', 'ru-RU-SvetlanaNeural', 'en-US-AriaNeural'];
    return defaults.includes(voiceName);
  }

  private sendError(client: Client, message: string): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'error', message }));
      setTimeout(() => client.close(1008, message), 100);
    }
  }

  private async stopIfNoCredits(client: Client, userId: string): Promise<void> {
    const tierInfo = await this.subscriptions.getCurrentTierInfo(userId);
    if (tierInfo.creditsRemaining > 0) return;

    this.logger.warn(`[credits exhausted] user=${userId}, terminating session`);

    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: 'error',
          code: 'credits_exhausted',
          message:
            'Credits exhausted. Translation stopped. Upgrade your plan to continue.',
        }),
      );
    }

    const upstream = this.upstreams.get(client);
    if (upstream?.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ action: 'stop' }));
      upstream.close();
      this.upstreams.delete(client);
    }

    this.playbackTracking.delete(client);

    setTimeout(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1008, 'Credits exhausted');
      }
    }, 200);
  }
}
