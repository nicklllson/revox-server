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

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  create(@Body() data: Prisma.VideoCreateInput) {
    return this.videosService.createVideo(data);
  }

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
  ) {
    return this.videosService.findAll({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      where: search
        ? {
            OR: [{ title: { contains: search } }],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videosService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Prisma.VideoUpdateInput) {
    return this.videosService.updateVideo({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videosService.deleteVideo({ id });
  }
}
