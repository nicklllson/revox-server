import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

import { LoginDto } from './dto/login';
import { RegisterDto } from './dto/register';
import { VerifyEmailDto } from './dto/verify-email';

import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    console.log('test');
    const tokens = await this.authService.refresh(user.sub, user.email);
    console.log(tokens);
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
