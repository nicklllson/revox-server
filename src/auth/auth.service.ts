import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { LoginDto } from './dto/login';
import { RegisterDto } from './dto/register';
import { VerifyEmailDto } from './dto/verify-email';

import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    const user = await this.usersService.createUser({
      ...dto,
      password: hashedPassword,
      confirmationCode: randomBytes(32).toString('hex'),
      verificationCode,
      verificationCodeExpiresAt,
    });

    await this.mailService.sendVerificationCode(user.email, verificationCode);

    return this.generateTokens(user.id, user.email);
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

  async verifyEmail(dto: VerifyEmailDto, email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException('No verification code was sent');
    }

    if (new Date() > user.verificationCodeExpiresAt) {
      throw new BadRequestException('Verification code has expired');
    }

    if (user.verificationCode !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.usersService.updateUser({
      where: { id: user.id },
      data: {
        emailConfirmed: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    return { success: true };
  }

  async resendCode(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

    if (user.emailConfirmed) {
      throw new BadRequestException('Email is already confirmed');
    }

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateUser({
      where: { id: user.id },
      data: { verificationCode, verificationCodeExpiresAt },
    });

    await this.mailService.sendVerificationCode(email, verificationCode);

    return { success: true };
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
