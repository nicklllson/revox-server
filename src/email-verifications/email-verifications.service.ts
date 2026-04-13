import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, EmailVerification } from 'generated/prisma/client';

@Injectable()
export class EmailVerificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.EmailVerificationCreateInput): Promise<EmailVerification> {
    return this.prisma.emailVerification.create({ data });
  }

  async findByEmail(email: string): Promise<EmailVerification | null> {
    return this.prisma.emailVerification.findUnique({
      where: { email },
    });
  }

  async update(
    where: Prisma.EmailVerificationWhereUniqueInput,
    data: Prisma.EmailVerificationUpdateInput,
  ): Promise<EmailVerification> {
    return this.prisma.emailVerification.update({ where, data });
  }

  async delete(where: Prisma.EmailVerificationWhereUniqueInput): Promise<EmailVerification> {
    return this.prisma.emailVerification.delete({ where });
  }
}
