import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  getUserFavorites(@CurrentUser() user: { id: string }) {
    return this.favoritesService.getUserFavorites(user.id);
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
