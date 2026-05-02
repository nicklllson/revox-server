import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { Prisma } from 'generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateVideoDto } from './dto/create-video.dto';

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get(':videoId')
  findUserVideo(
    @Param('videoId') videoId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.videosService.findVideoByUserId(user.id, videoId);
  }

  @Get()
  async findUserVideos(
    @CurrentUser() user: { id: string; email: string },
    @Query('search') search: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const result = await this.videosService.findAllByUserId({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      where: {
        userId: user.id,
        ...(search ? { OR: [{ title: { contains: search } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        favorites: { where: { userId: user.id } },
      },
    });

    return {
      ...result,
      data: result.data.map((video: any) => ({
        ...video,
        isFavorite: !!video.favorites?.length,
        favorites: undefined,
      })),
    };
  }

  @Post()
  createUserVideo(
    @Body() data: CreateVideoDto,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.videosService.createVideoByUserId(user.id, data);
  }

  @Patch(':videoId')
  updateUserVideo(
    @Param('videoId') videoId: string,
    @Body() data: Prisma.VideoUpdateInput,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.videosService.updateVideoByUserId(user.id, videoId, data);
  }

  @Delete(':videoId')
  removeUserVideo(
    @Param('videoId') videoId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.videosService.deleteVideoByUserId(user.id, videoId);
  }
}
