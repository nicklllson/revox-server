import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from './jwt.strategy';

type RequestCookies = {
  refresh_token?: string;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookies = req?.cookies as RequestCookies | undefined;
          return cookies?.refresh_token ?? null;
        },
      ]),
      secretOrKey: process.env.JWT_REFRESH_SECRET ?? '',
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<JwtPayload & { refreshToken: string }> {
    const cookies = (await req.cookies) as RequestCookies | undefined;
    const refreshToken = cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException();
    return { ...payload, refreshToken };
  }
}
