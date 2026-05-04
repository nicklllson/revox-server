import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Video } from 'generated/prisma/client';
import { PaginateArgs, PaginationService } from 'src/common/pagination';
import { getYouTubeId } from 'src/common/videos/services';
import { CreateVideoDto } from './dto/create-video.dto';

@Injectable()
export class VideosService {
  constructor(
    private prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  async findById(id: string): Promise<Video | null> {
    return this.prisma.video.findUnique({
      where: { id },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.VideoWhereUniqueInput;
    where?: Prisma.VideoWhereInput;
    orderBy?: Prisma.VideoOrderByWithRelationInput;
    userId?: string;
  }) {
    const { skip, take, cursor, where, orderBy, userId } = params;

    const videos = await this.prisma.video.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        favorites: userId ? { where: { userId } } : false,
      },
    });

    return videos.map(({ favorites, ...video }) => ({
      ...video,
      isFavorite: !!favorites?.length,
    }));
  }

  async createVideo(data: Prisma.VideoCreateInput): Promise<Video> {
    return this.prisma.video.create({
      data,
    });
  }

  async updateVideo(params: {
    where: Prisma.VideoWhereUniqueInput;
    data: Prisma.VideoUpdateInput;
  }): Promise<Video> {
    const { where, data } = params;
    return this.prisma.video.update({
      where,
      data,
    });
  }

  async deleteVideo(where: Prisma.VideoWhereUniqueInput): Promise<Video> {
    return this.prisma.video.delete({
      where,
    });
  }

  findAllByUserId(args: PaginateArgs) {
    return this.paginationService.paginate<Video>(this.prisma.video, args);
  }

  async createVideoByUserId(
    userId: string,
    dto: CreateVideoDto,
  ): Promise<Video> {
    const youtubeVideoId = getYouTubeId(dto.videoUrl);
    return this.prisma.video.create({
      data: {
        youtubeVideoId,
        ...dto,
        user: {
          connect: { id: userId },
        },
      },
    });
  }

  async updateVideoByUserId(
    userId: string,
    videoId: string,
    data: Prisma.VideoUpdateInput,
  ): Promise<Video> {
    return this.prisma.video.update({
      where: {
        id: videoId,
        userId,
      },
      data,
    });
  }

  async deleteVideoByUserId(userId: string, videoId: string): Promise<Video> {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, userId },
    });

    if (!video) throw new NotFoundException('Video not found');

    console.log('deleting video:', {
      videoId,
      externalJobId: video.externalJobId,
    });

    if (video.externalJobId) {
      const ttsUrl = process.env.TTS_HTTP_URL ?? 'http://localhost:8000';
      const res = await fetch(`${ttsUrl}/api/jobs/${video.externalJobId}`, {
        method: 'DELETE',
      }).catch((err) => {
        console.warn(`Failed to delete TTS job: ${err.message}`);
        return null;
      });
      console.log('TTS delete response:', res?.status);
    }

    return this.prisma.video.delete({
      where: { id: videoId, userId },
    });
  }

  async findVideoByUserId(
    userId: string,
    videoId: string,
  ): Promise<(Video & { isFavorite: boolean }) | null> {
    const [video, favorite] = await Promise.all([
      this.prisma.video.findFirst({
        where: { id: videoId, userId },
      }),
      this.prisma.favorite.findUnique({
        where: { userId_videoId: { userId, videoId } },
      }),
    ]);

    if (!video) throw new NotFoundException('Video not found');

    return {
      ...video,
      isFavorite: !!favorite,
    };
  }
}
