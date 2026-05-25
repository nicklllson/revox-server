import { IsEnum } from 'class-validator';
import { SubscriptionTier } from 'generated/prisma/enums';

export class CreatePaymentDto {
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;
}
