import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async getUserFavorites(
    @CurrentUser() user: { id: string },
    @Query('search') search: string,
    @Query('lang') lang?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const result = await this.favoritesService.findAllByUserId({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      where: {
        userId: user.id,
        video: {
          ...(search ? { title: { contains: search } } : {}),
          ...(lang ? { language: lang } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        video: true,
      },
    });

    return {
      ...result,
      data: result.data.map((video: any) => ({
        ...video,
        isFavorite: true,
      })),
    };
  }

  @Post(':videoId')
  addToFavorites(
    @Param('videoId') videoId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.favoritesService.addToFavorites(user.id, videoId);
  }

  @Delete(':videoId')
  removeFromFavorites(
    @Param('videoId') videoId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.favoritesService.removeFromFavorites(user.id, videoId);
  }
}
