import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginateArgs, PaginationService } from 'src/common/pagination';
import { Video } from 'generated/prisma/browser';

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  findAllByUserId(args: PaginateArgs) {
    return this.paginationService.paginate<Video>(this.prisma.favorite, args);
  }

  async getUserFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        video: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addToFavorites(userId: string, videoId: string) {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, userId },
    });

    if (!video) throw new NotFoundException('Video not found');

    return this.prisma.favorite.create({
      data: { userId, videoId },
      include: { video: true },
    });
  }

  async removeFromFavorites(userId: string, videoId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });

    if (!favorite) throw new NotFoundException('Favorite not found');

    return this.prisma.favorite.delete({
      where: { userId_videoId: { userId, videoId } },
    });
  }
}
