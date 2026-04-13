import { Module } from '@nestjs/common';
import { EmailVerificationsService } from './email-verifications.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EmailVerificationsService],
  exports: [EmailVerificationsService],
})
export class EmailVerificationsModule {}
