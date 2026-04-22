/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { LoginDto } from './dto/login';
import { RegisterDto } from './dto/register';
import { VerifyEmailDto } from './dto/verify-email';

import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { EmailVerificationsService } from '../email-verifications/email-verifications.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
    private emailVerificationsService: EmailVerificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already in use');

    const existingVerification =
      await this.emailVerificationsService.findByEmail(dto.email);
    if (existingVerification)
      throw new ConflictException('Email verification already in progress');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.emailVerificationsService.create({
      email: dto.email,
      password: hashedPassword,
      verificationCode,
      verificationCodeExpiresAt,
    });

    await this.mailService.sendVerificationCode(dto.email, verificationCode);

    console.log('Code from email -', verificationCode);

    return { success: true };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.password) return;

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user.id, user.email);
  }

  async refresh(userId: string, email: string) {
    return this.generateTokens(userId, email);
  }

  async logout() {
    return { success: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const verification = await this.emailVerificationsService.findByEmail(
      dto.email,
    );
    if (!verification) throw new UnauthorizedException('No verification found');

    if (new Date() > verification.verificationCodeExpiresAt) {
      await this.emailVerificationsService.delete({ id: verification.id });
      throw new BadRequestException('Verification code has expired');
    }

    if (verification.verificationCode !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }

    const user = await this.usersService.createUser({
      email: verification.email,
      password: verification.password,
      nickname: verification.nickname,
      origin: 'LOCAL',
      emailConfirmed: true,
      profileCompleted: false,
    });

    await this.emailVerificationsService.delete({ id: verification.id });

    return this.generateTokens(user.id, user.email);
  }

  async resendCode(email: string) {
    const verification =
      await this.emailVerificationsService.findByEmail(email);
    if (!verification) throw new UnauthorizedException('No verification found');

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.emailVerificationsService.update(
      { id: verification.id },
      { verificationCode, verificationCodeExpiresAt },
    );

    await this.mailService.sendVerificationCode(email, verificationCode);

    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user)
      return { message: 'If this email exists, you will receive a letter' };

    const token = randomBytes(32).toString('hex');
    const exp = new Date(Date.now() + 1000 * 60 * 30); // 30 минут

    await this.prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: token,
        resetPasswordTokenExp: exp,
      },
    });

    await this.mailService.sendResetPassword(email, token);

    return { message: 'If this email exists, you will receive a letter' };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordTokenExp: { gt: new Date() },
      },
    });

    if (!user) throw new BadRequestException('Token is invalid or expired');

    const hash = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hash,
        resetPasswordToken: null,
        resetPasswordTokenExp: null,
      },
    });

    return { message: 'Password updated successfully' };
  }

  // ── Приватные методы ───────────────────────────────────────────

  private generateTokens(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  private generateVerificationCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}
