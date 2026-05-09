import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

@Controller('translations')
@UseGuards(JwtAuthGuard)
export class TranslationsController {
  constructor(private configService: ConfigService) {}

  @Get('video/:sessionId')
  async streamVideo(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ttsUrl =
      this.configService.get<string>('TTS_HTTP_URL') ?? 'http://localhost:8000';

    const upstream = await fetch(`${ttsUrl}/video/${sessionId}`, {
      headers: {
        ...(req.headers['range'] ? { Range: req.headers['range'] } : {}),
      },
    });

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (upstream.body) {
      await pipeline(Readable.fromWeb(upstream.body as any), res);
    } else {
      res.end();
    }
  }
}
