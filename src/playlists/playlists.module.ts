import { Module } from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { PlaylistsController } from './playlists.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaginationModule } from 'src/common/pagination';

@Module({
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  imports: [PrismaModule, PaginationModule],
})
export class PlaylistsModule {}
