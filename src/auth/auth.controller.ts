import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

import { LoginDto } from './dto/login';
import { RegisterDto } from './dto/register';
import { VerifyEmailDto } from './dto/verify-email';

import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { MailService } from 'src/mail/mail.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private mailService: MailService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);
    return { success: true };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    if (!tokens) return;
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens?.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: { sub: string; email: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(user.sub, user.email);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async logout(
    @CurrentUser() user: { id: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('refresh_token');
    return this.authService.logout();
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyEmail(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('resend-code')
  @HttpCode(200)
  async resendCode(@Body() body: { email: string }) {
    return this.authService.resendCode(body.email);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() { email }: { email: string }) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() { token, password }: { token: string; password: string },
  ) {
    return this.authService.resetPassword(token, password);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user: { id: string; email: string } },
    @Res() res: Response,
  ) {
    const user = req.user as { id: string; email: string };
    const tokens = this.authService.generateTokens(user.id, user.email);

    this.setRefreshCookie(res, tokens.refreshToken);

    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    res.redirect(`${clientUrl}/auth/callback?token=${tokens.accessToken}`);
  }

  // ── Хелпер ────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true, // недоступен из JS
      secure: false, // только HTTPS
      sameSite: 'lax', // strict - prod
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });
  }
}
