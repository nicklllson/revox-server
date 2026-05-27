import { Controller, Get, Post, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { TIER_CONFIGS } from 'src/config/tiers';
import { Public } from 'src/auth/decorators/public.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PaginateArgs } from 'src/common/pagination';

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

  @Post('cancel')
  async cancel(@CurrentUser() user: { id: string }) {
    return this.subscriptions.cancelSubscription(user.id);
  }

  @Post('reactivate')
  async reactivate(@CurrentUser() user: { id: string }) {
    return this.subscriptions.reactivateSubscription(user.id);
  }

  @Get('history')
  async history(
    @CurrentUser() user: { id: string },
    @Query() args: PaginateArgs,
  ) {
    return this.subscriptions.getHistory(user.id, args);
  }
}
