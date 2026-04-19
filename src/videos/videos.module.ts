import { Module } from '@nestjs/common';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaginationModule } from 'src/common/pagination';

@Module({
  controllers: [VideosController],
  providers: [VideosService],
  imports: [PrismaModule, PaginationModule],
})
export class VideosModule {}
