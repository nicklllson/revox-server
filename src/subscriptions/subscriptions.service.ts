import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Subscription,
  SubscriptionEventType,
  SubscriptionHistory,
  SubscriptionStatus,
  SubscriptionTier,
} from 'generated/prisma/client';
import { getTierConfig, TierConfig } from 'src/config/tiers';
import { PaginateArgs, PaginationService } from 'src/common/pagination';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private paginationService: PaginationService,
  ) {}

  async getOrCreateCurrent(userId: string): Promise<Subscription> {
    let sub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      sub = await this.createFreeSubscription(userId);
    }

    return this.rolloverIfNeeded(sub);
  }

  private async createFreeSubscription(userId: string): Promise<Subscription> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
      },
    });

    await this.recordHistory({
      userId,
      eventType: SubscriptionEventType.CREATED,
      tier: SubscriptionTier.FREE,
    });

    return sub;
  }

  private async rolloverIfNeeded(sub: Subscription): Promise<Subscription> {
    const now = new Date();
    if (!sub.periodEnd || sub.periodEnd > now) {
      return sub;
    }

    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const wasFree = sub.tier === SubscriptionTier.FREE;
    const isExpiring = !wasFree;

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        tier:
          sub.tier === SubscriptionTier.FREE
            ? SubscriptionTier.FREE
            : SubscriptionTier.FREE,
        status:
          sub.tier === SubscriptionTier.FREE
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.EXPIRED,
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    if (isExpiring) {
      await this.recordHistory({
        userId: sub.userId,
        eventType: SubscriptionEventType.EXPIRED,
        tier: SubscriptionTier.FREE,
        metadata: { previousTier: sub.tier },
      });
    }

    return updated;
  }

  async activateTier(
    userId: string,
    tier: SubscriptionTier,
    paymentId?: string,
  ): Promise<Subscription> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    const previousTier = existing?.tier ?? SubscriptionTier.FREE;

    const sub = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        tier,
        status: SubscriptionStatus.ACTIVE,
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      create: {
        userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
      },
    });

    const eventType =
      previousTier === tier
        ? SubscriptionEventType.RENEWED
        : SubscriptionEventType.UPGRADED;

    await this.recordHistory({
      userId,
      eventType,
      tier,
      paymentId,
      metadata: { previousTier },
    });

    return sub;
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const sub = await this.getOrCreateCurrent(userId);

    if (sub.tier === SubscriptionTier.FREE) {
      throw new BadRequestException('Cannot cancel a free subscription');
    }

    if (sub.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is already canceled');
    }

    const now = new Date();

    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: now,
      },
    });

    await this.recordHistory({
      userId,
      eventType: SubscriptionEventType.CANCELED,
      tier: sub.tier,
      metadata: {
        // Сохраняем когда отменили и до какой даты подписка остаётся активной
        canceledAt: now.toISOString(),
        activeUntil: sub.periodEnd?.toISOString(),
      },
    });

    return updated;
  }

  async consumeCreditsSilent(userId: string, credits: number): Promise<void> {
    await this.prisma.subscription.update({
      where: { userId },
      data: { creditsUsed: { increment: credits } },
    });
  }

  async reactivateSubscription(userId: string): Promise<Subscription> {
    const sub = await this.getOrCreateCurrent(userId);

    if (!sub.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not canceled');
    }

    if (sub.tier === SubscriptionTier.FREE) {
      throw new BadRequestException('Cannot reactivate a free subscription');
    }

    const now = new Date();
    if (sub.periodEnd && sub.periodEnd <= now) {
      throw new BadRequestException(
        'Subscription period has ended. Please purchase a new subscription.',
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    await this.recordHistory({
      userId,
      eventType: SubscriptionEventType.REACTIVATED,
      tier: sub.tier,
    });

    return updated;
  }

  async consumeCredits(userId: string, credits: number): Promise<void> {
    const sub = await this.getOrCreateCurrent(userId);
    const config = getTierConfig(sub.tier);

    if (sub.creditsUsed + credits > config.creditsPerMonth) {
      throw new ForbiddenException(
        `Credit limit exceeded on ${config.name} plan. ` +
          `Used: ${sub.creditsUsed}/${config.creditsPerMonth}, required: ${credits}.`,
      );
    }

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { creditsUsed: { increment: credits } },
    });
  }

  async assertFeatureAvailable(
    userId: string,
    feature: keyof TierConfig['features'],
  ): Promise<void> {
    const sub = await this.getOrCreateCurrent(userId);
    const config = getTierConfig(sub.tier);
    if (!config.features[feature]) {
      throw new ForbiddenException(
        `Function "${feature}" is not available in ${config.name} tariff`,
      );
    }
  }

  async assertProviderAvailable(
    userId: string,
    kind: 'translator' | 'tts' | 'whisper',
    providerName: string,
  ): Promise<void> {
    const sub = await this.getOrCreateCurrent(userId);
    const config = getTierConfig(sub.tier);

    const map = {
      translator: config.availableTranslators,
      tts: config.availableTtsProviders,
      whisper: config.availableWhisperModels,
    };

    if (!map[kind].includes(providerName)) {
      throw new ForbiddenException(
        `Provider "${providerName}" is not available in ${config.name} tariff`,
      );
    }
  }

  async getCurrentTierInfo(userId: string) {
    const sub = await this.getOrCreateCurrent(userId);
    const config = getTierConfig(sub.tier);
    return {
      subscription: {
        tier: sub.tier,
        status: sub.status,
        creditsUsed: sub.creditsUsed,
        periodEnd: sub.periodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd, // ← добавили
        canceledAt: sub.canceledAt,
      },
      config,
      creditsRemaining: Math.max(0, config.creditsPerMonth - sub.creditsUsed),
    };
  }

  private async recordHistory(params: {
    userId: string;
    eventType: SubscriptionEventType;
    tier: SubscriptionTier;
    paymentId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.prisma.subscriptionHistory.create({
      data: {
        userId: params.userId,
        eventType: params.eventType,
        tier: params.tier,
        paymentId: params.paymentId,
        metadata: params.metadata,
      },
    });
  }

  getHistory(userId: string, args: PaginateArgs) {
    return this.paginationService.paginate<SubscriptionHistory>(
      this.prisma.subscriptionHistory,
      {
        ...args,
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
    );
  }
}
