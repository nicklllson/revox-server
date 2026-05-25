import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { YooKassaProvider } from 'src/utils/providers/yookassa.provider';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import {
  PaymentProviderType,
  PaymentStatus,
  SubscriptionTier,
} from 'generated/prisma/enums';
import { getTierConfig } from 'src/config/tiers';
import { Payment } from 'generated/prisma/client';
import { TPaymentStatus } from 'src/utils/adapters/payment.adapter.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yooKassa: YooKassaProvider,
    private readonly subscriptions: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

  async createPaymentForTier(
    userId: string,
    tier: SubscriptionTier,
  ): Promise<{ paymentId: string; confirmationUrl: string }> {
    if (tier === SubscriptionTier.FREE) {
      throw new BadRequestException('Free tier does not require payment');
    }

    const tierConfig = getTierConfig(tier);
    const idempotenceKey = randomUUID();
    const frontendUrl = this.config.getOrThrow<string>('CLIENT_URL');

    // Конвертируем USD → RUB по курсу из env (фикс на момент создания платежа).
    // priceUsd в центах ($9.00 = 900), курс в рублях за 1 USD.
    // Например 900 * 95 = 85500 копеек = 855 рублей.
    const usdToRubRate = Number(
      this.config.get<string>('USD_TO_RUB_RATE') ?? '95',
    );
    const amountKopecks = Math.round(tierConfig.priceUsd * usdToRubRate);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: PaymentProviderType.YOOKASSA,
        status: PaymentStatus.PENDING,
        tier,
        amount: amountKopecks,
        currency: 'RUB',
      },
    });

    try {
      const result = await this.yooKassa.createPayment({
        amount: amountKopecks,
        currency: 'RUB',
        description: `Revox ${tierConfig.name} subscription`,
        userId,
        tier,
        returnUrl: `${frontendUrl}/payment/return?paymentId=${payment.id}`,
        idempotenceKey,
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: result.externalId,
          confirmationUrl: result.confirmationUrl,
          metadata: result.raw,
        },
      });

      return {
        paymentId: updated.id,
        confirmationUrl: result.confirmationUrl,
      };
    } catch (err) {
      this.logger.error(`Failed to create YooKassa payment: ${err}`);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CANCELED,
          metadata: { error: String(err) },
        },
      });
      throw err;
    }
  }

  async handleYooKassaWebhook(body: any): Promise<void> {
    const event = await this.yooKassa.parseWebhook(body);

    const payment = await this.prisma.payment.findUnique({
      where: { externalId: event.externalId },
    });

    if (!payment) {
      this.logger.warn(
        `Webhook for unknown payment externalId=${event.externalId}`,
      );
      return;
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      this.logger.log(`Payment ${payment.id} already processed`);
      return;
    }

    let verifiedStatus = event.status;
    try {
      const fresh: Record<string, string | undefined> =
        await this.yooKassa.fetchPaymentStatus(event.externalId);

      if (fresh && typeof fresh === 'object' && 'status' in fresh) {
        verifiedStatus = fresh.status as TPaymentStatus;
      }
    } catch (err) {
      this.logger.error(`Failed to re-verify payment: ${err}`);
      return;
    }

    const newStatus = this.mapStatus(verifiedStatus);

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        metadata: {
          ...((payment.metadata as object) ?? {}),
          webhook: event.raw,
        },
      },
    });

    if (newStatus === PaymentStatus.SUCCEEDED) {
      await this.subscriptions.activateTier(payment.userId, payment.tier);
      this.logger.log(
        `Activated ${payment.tier} for user ${payment.userId} (payment ${payment.id})`,
      );
    }
  }

  async getPayment(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'canceled':
        return PaymentStatus.CANCELED;
      case 'waiting_for_capture':
        return PaymentStatus.WAITING_FOR_CAPTURE;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
