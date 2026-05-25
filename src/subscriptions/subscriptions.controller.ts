import { Controller, Get } from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { TIER_CONFIGS } from 'src/config/tiers';
import { Public } from 'src/auth/decorators/public.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me')
  async getMy(@CurrentUser() user: { id: string }) {
    const userId = user.id;
    return this.subscriptions.getCurrentTierInfo(userId);
  }

  @Public()
  @Get('tiers')
  getTiers() {
    return Object.values(TIER_CONFIGS);
  }
}
