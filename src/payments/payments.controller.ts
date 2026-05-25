import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePaymentDto,
  ) {
    const userId = user.id;
    return this.paymentsService.createPaymentForTier(userId, dto.tier);
  }

  @Get(':id')
  async getStatus(
    @CurrentUser() user: { id: string },
    @Param('id') paymentId: string,
  ) {
    const userId = user.id;
    const payment = await this.paymentsService.getPayment(paymentId, userId);
    return {
      id: payment.id,
      status: payment.status,
      tier: payment.tier,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  @Public()
  @Post('webhook/yookassa')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: any) {
    await this.paymentsService.handleYooKassaWebhook(body);
    return { received: true };
  }
}
