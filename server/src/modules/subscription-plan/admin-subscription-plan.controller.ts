import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SubscriptionPlanService } from './subscription-plan.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Subscription Plans (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/subscription-plans')
export class AdminSubscriptionPlanController {
  constructor(private readonly planService: SubscriptionPlanService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new subscription plan' })
  async createPlan(@Body() createDto: CreateSubscriptionPlanDto) {
    const result = await this.planService.createPlan(createDto);
    return {
      success: true,
      message: 'Subscription plan created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscription plans (including inactive)' })
  async getAllPlans() {
    const result = await this.planService.getAllPlansAdmin();
    return {
      success: true,
      message: 'Subscription plans retrieved successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  async updatePlan(
    @Param('id') id: string,
    @Body() updateDto: UpdateSubscriptionPlanDto,
  ) {
    const result = await this.planService.updatePlan(id, updateDto);
    return {
      success: true,
      message: 'Subscription plan updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription plan' })
  async deletePlan(@Param('id') id: string) {
    await this.planService.deletePlan(id);
    return {
      success: true,
      message: 'Subscription plan deleted successfully',
      data: null,
    };
  }
}
