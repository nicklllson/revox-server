import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TranslationsGateway } from './translations.gateway';
import { TranslationsController } from './translations.controller';
import { WsJwtAuthGuard } from 'src/auth/guards/ws-jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TranslationsController],
  providers: [TranslationsGateway, WsJwtAuthGuard],
})
export class TranslationsModule {}
