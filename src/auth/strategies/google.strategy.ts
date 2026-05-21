import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface GoogleProfile {
  email: string;
  nickname: string;
  avatarUrl: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email = profile.emails[0].value;
    const avatarUrl = profile.photos?.[0]?.value ?? null;
    const nickname = profile.displayName ?? profile.name?.givenName ?? null;

    let user = await this.usersService.findByEmail(email);

    if (!user) {
      user = await this.usersService.createUser({
        email,
        password: null,
        nickname,
        avatarUrl,
        origin: 'GOOGLE',
        emailConfirmed: true,
        profileCompleted: false,
      });
    }

    done(null, user);
  }
}
