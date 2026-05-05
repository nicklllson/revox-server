import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginateArgs, PaginationService } from 'src/common/pagination';
import { Playlist } from 'generated/prisma/browser';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class PlaylistsService {
  constructor(
    private prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  findAllByUserId(args: PaginateArgs) {
    return this.paginationService.paginate<Playlist>(
      this.prisma.playlist,
      args,
    );
  }

  async getPlaylist(id: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { video: true },
        },
      },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== userId) throw new ForbiddenException();

    return playlist;
  }

  async createPlaylist(userId: string, dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: { ...dto, userId },
    });
  }

  async updatePlaylist(id: string, userId: string, dto: UpdatePlaylistDto) {
    await this.assertOwnership(id, userId);

    return this.prisma.playlist.update({
      where: { id },
      data: dto,
    });
  }

  async deletePlaylist(id: string, userId: string) {
    await this.assertOwnership(id, userId);

    return this.prisma.playlist.delete({ where: { id } });
  }

  async addVideo(playlistId: string, videoId: string, userId: string) {
    await this.assertOwnership(playlistId, userId);

    const video = await this.prisma.video.findFirst({
      where: { id: videoId, userId },
    });

    if (!video) throw new NotFoundException('Video not found');

    const lastItem = await this.prisma.playlistItem.findFirst({
      where: { playlistId },
      orderBy: { position: 'desc' },
    });

    await this.prisma.playlist.update({
      data: {
        thumbnail: video.thumbnail,
      },
      where: { id: playlistId },
    });

    return this.prisma.playlistItem.create({
      data: {
        playlistId,
        videoId,
        position: lastItem ? lastItem.position + 1 : 0,
      },
      include: { video: true },
    });
  }

  async removeVideo(playlistId: string, videoId: string, userId: string) {
    await this.assertOwnership(playlistId, userId);

    const item = await this.prisma.playlistItem.findUnique({
      where: { playlistId_videoId: { playlistId, videoId } },
    });

    if (!item) throw new NotFoundException('Video not in playlist');

    return this.prisma.playlistItem.delete({
      where: { playlistId_videoId: { playlistId, videoId } },
    });
  }

  private async assertOwnership(playlistId: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== userId) throw new ForbiddenException();
  }
}
