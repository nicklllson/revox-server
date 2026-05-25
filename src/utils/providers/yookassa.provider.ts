import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProviderAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentWebhookEvent,
} from '../adapters/payment.adapter.provider';

/**
 * YooKassa REST API: https://yookassa.ru/developers/api
 *
 * Регистрация и тестовый режим:
 * 1. https://yookassa.ru → зарегистрироваться (можно как самозанятый)
 * 2. Личный кабинет → создать "Тестовый магазин"
 * 3. Получить shopId и secretKey (test_*)
 * 4. Тестовая карта успеха: 5555 5555 5555 4444, любая будущая дата, CVC 123
 * 5. Никакие реальные деньги не списываются
 */
@Injectable()
export class YooKassaProvider extends PaymentProviderAdapter {
  readonly name = 'yookassa';

  private readonly logger = new Logger(YooKassaProvider.name);
  private readonly shopId: string = process.env.YOOKASSA_SHOP_ID ?? '';
  private readonly secretKey: string = process.env.YOOKASSA_SECRET ?? '';
  private readonly apiUrl = 'https://api.yookassa.ru/v3';

  constructor(private readonly config: ConfigService) {
    super();
    this.shopId = this.config.getOrThrow<string>('YOOKASSA_SHOP_ID');
    this.secretKey = this.config.getOrThrow<string>('YOOKASSA_SECRET_KEY');
  }

  private get authHeader(): string {
    const token = Buffer.from(`${this.shopId}:${this.secretKey}`).toString(
      'base64',
    );
    return `Basic ${token}`;
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    const amountValue = (params.amount / 100).toFixed(2);

    const body = {
      amount: {
        value: amountValue,
        currency: params.currency,
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      description: params.description,
      metadata: {
        userId: params.userId,
        tier: params.tier,
      },
    };

    const response = await fetch(`${this.apiUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        'Idempotence-Key': params.idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`YooKassa createPayment failed: ${errorText}`);
      throw new Error(`YooKassa API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;

    return {
      externalId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url,
      status: data.status,
      raw: data,
    };
  }

  async parseWebhook(body: any): Promise<PaymentWebhookEvent> {
    const payment = body?.object;
    if (!payment?.id) {
      throw new Error('Invalid YooKassa webhook payload');
    }

    return {
      externalId: payment.id,
      status: payment.status,
      amount: Math.round(parseFloat(payment.amount.value) * 100),
      metadata: payment.metadata ?? {},
      raw: body,
    };
  }

  verifyWebhook(): boolean {
    return true;
  }

  async fetchPaymentStatus(externalId: string) {
    const response = await fetch(`${this.apiUrl}/payments/${externalId}`, {
      headers: { Authorization: this.authHeader },
    });

    if (!response.ok) {
      throw new Error(`YooKassa fetch status failed: ${response.status}`);
    }

    return await response.json();
  }
}
