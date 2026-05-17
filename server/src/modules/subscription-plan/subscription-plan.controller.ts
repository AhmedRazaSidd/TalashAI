import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { SubscriptionPlanService } from './subscription-plan.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Subscription Plans (Mobile)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription-plans')
export class SubscriptionPlanController {
  constructor(private readonly planService: SubscriptionPlanService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active subscription plans' })
  async getActivePlans() {
    const plans = await this.planService.getActivePlans();
    return {
      success: true,
      message: 'Active subscription plans retrieved successfully',
      data: plans,
    };
  }

  @Post(':id/subscribe')
  @ApiOperation({ summary: 'Subscribe to a plan (simulated checkout)' })
  async subscribe(@Request() req, @Param('id') planId: string) {
    const updatedUser = await this.planService.subscribeUser(req.user.userId, planId);
    return {
      success: true,
      message: 'Subscribed to plan successfully',
      data: updatedUser,
    };
  }
}
