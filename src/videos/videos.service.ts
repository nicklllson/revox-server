import { Injectable } from '@nestjs/common';
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
  }): Promise<Video[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.video.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
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
    return this.prisma.video.delete({
      where: {
        id: videoId,
        userId,
      },
    });
  }

  async findVideoByUserId(
    userId: string,
    videoId: string,
  ): Promise<Video | null> {
    return this.prisma.video.findFirst({
      where: { id: videoId, userId },
    });
  }
}
