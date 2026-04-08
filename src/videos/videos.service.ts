import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Video } from 'generated/prisma/client';

@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}

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
}
