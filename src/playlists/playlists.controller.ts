import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Controller('playlists')
@UseGuards(JwtAuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get()
  getUserPlaylists(
    @CurrentUser() user: { id: string },
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.playlistsService.findAllByUserId({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      where: {
        userId: user.id,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  @Post()
  createPlaylist(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistsService.createPlaylist(user.id, dto);
  }

  @Get(':id')
  getPlaylist(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.playlistsService.getPlaylist(id, user.id);
  }

  @Patch(':id')
  updatePlaylist(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.updatePlaylist(id, user.id, dto);
  }

  @Delete(':id')
  deletePlaylist(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.playlistsService.deletePlaylist(id, user.id);
  }

  @Post(':id/videos/:videoId')
  addVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.playlistsService.addVideo(id, videoId, user.id);
  }

  @Delete(':id/videos/:videoId')
  removeVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.playlistsService.removeVideo(id, videoId, user.id);
  }
}
