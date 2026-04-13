import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from 'generated/prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() data: Prisma.UserCreateInput) {
    return this.usersService.createUser(data);
  }

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      where: search
        ? {
            OR: [
              { email: { contains: search } },
              { nickname: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch()
  update(
    @CurrentUser() user: { id: string; email: string },
    @Body()
    data: Omit<
      Prisma.UserUpdateInput,
      'password' | 'emailConfirmed' | 'profileCompleted' | 'origin'
    >,
  ) {
    return this.usersService.updateUser({
      where: { id: user.id },
      data,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.deleteUser({ id });
  }
}
