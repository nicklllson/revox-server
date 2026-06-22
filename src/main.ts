import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { WsAdapter } from '@nestjs/platform-ws';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const clientURL = process.env.CLIENT_URL;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(cookieParser());
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:4173', clientURL],
    credentials: true,
  });
  app.setGlobalPrefix('api', {
    exclude: [
      '/auth/google',
      '/auth/google/callback',
      '/payments/webhook/yookassa',
    ],
  });
  await app.listen(process.env.PORT ?? 4200);
}
bootstrap();
