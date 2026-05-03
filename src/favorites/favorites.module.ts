import { Module } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaginationModule } from 'src/common/pagination';

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService],
  imports: [PrismaModule, PaginationModule],
})
export class FavoritesModule {}
