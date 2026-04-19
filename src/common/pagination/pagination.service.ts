import { Injectable } from '@nestjs/common';

export interface PaginateArgs {
  skip?: number;
  take?: number;
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    skip: number;
    take: number;
    total: number;
    hasMore: boolean;
    nextSkip: number | null;
  };
}

type PrismaModel = {
  findMany: (args: unknown) => Promise<unknown[]>;
  count: (args: unknown) => Promise<number>;
};

@Injectable()
export class PaginationService {
  async paginate<T>(
    model: PrismaModel,
    args: PaginateArgs = {},
  ): Promise<PaginatedResult<T>> {
    const skip = args.skip ?? 0;
    const take = args.take ?? 20;

    const queryArgs = {
      skip,
      take,
      ...(args.where && { where: args.where }),
      ...(args.orderBy && { orderBy: args.orderBy }),
      ...(args.select && { select: args.select }),
      ...(args.include && { include: args.include }),
    };

    const [data, total] = await Promise.all([
      model.findMany(queryArgs) as Promise<T[]>,
      model.count({ where: args.where }),
    ]);

    const hasMore = skip + take < total;

    return {
      data,
      meta: {
        skip,
        take,
        total,
        hasMore,
        nextSkip: hasMore ? skip + take : null,
      },
    };
  }
}
