import { SubscriptionTier } from 'generated/prisma/enums';

export type CreatePaymentParams = {
  amount: number;
  currency: string;
  description: string;
  userId: string;
  tier: SubscriptionTier;
  returnUrl: string;
  idempotenceKey: string;
};

export type CreatePaymentResult = {
  externalId: string;
  confirmationUrl: string;
  status: string;
  raw: any;
};

export type TPaymentStatus =
  | 'succeeded'
  | 'canceled'
  | 'pending'
  | 'waiting_for_capture';

export type PaymentWebhookEvent = {
  externalId: string;
  status: TPaymentStatus;
  amount: number;
  metadata: Record<string, string>;
  raw: any;
};

/**
 * Абстракция платёжного провайдера.
 * Сегодня — YooKassa, после переезда — Stripe.
 * Никакой бизнес-логики здесь нет, только обёртка над HTTP API.
 */
export abstract class PaymentProviderAdapter {
  abstract readonly name: string;

  abstract createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult>;

  abstract parseWebhook(
    body: any,
    headers: Record<string, string>,
  ): Promise<PaymentWebhookEvent>;

  abstract verifyWebhook(
    body: any,
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): boolean;
}
