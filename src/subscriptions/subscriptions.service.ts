import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
} from 'generated/prisma/client';
import { getTierConfig, TierConfig } from 'src/config/tiers';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private createFreeSubscription(userId: string): Promise<Subscription> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.create({
      data: {
        userId,
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
      },
    });
  }

  private async rolloverIfNeeded(sub: Subscription): Promise<Subscription> {
    const now = new Date();
    if (!sub.periodEnd || sub.periodEnd > now) {
      return sub;
    }

    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.update({
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
      },
    });
  }

  async activateTier(
    userId: string,
    tier: SubscriptionTier,
  ): Promise<Subscription> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.upsert({
      where: { userId },
      update: {
        tier,
        status: SubscriptionStatus.ACTIVE,
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
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
  }

  /**
   * Списать кредиты без exception — используется при воспроизведении.
   * Если юзер слегка перебрал — фиксируем, но не прерываем.
   */
  async consumeCreditsSilent(userId: string, credits: number): Promise<void> {
    await this.prisma.subscription.update({
      where: { userId },
      data: { creditsUsed: { increment: credits } },
    });
  }

  /**
   * Списать кредиты с проверкой лимита.
   * Используется при старте перевода.
   */
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
      },
      config,
      creditsRemaining: Math.max(0, config.creditsPerMonth - sub.creditsUsed),
    };
  }
}
