import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionPlan, SubscriptionPlanDocument } from './schema/subscription-plan.schema';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    @InjectModel(SubscriptionPlan.name) private planModel: Model<SubscriptionPlanDocument>,
    private readonly userService: UserService,
  ) {}

  async createPlan(createDto: CreateSubscriptionPlanDto) {
    try {
      const plan = new this.planModel(createDto);
      return await plan.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('A subscription plan with this name already exists');
      }
      throw error;
    }
  }

  async getAllPlansAdmin() {
    return this.planModel.find().sort({ price: 1 }).exec();
  }

  async getActivePlans() {
    return this.planModel.find({ isActive: true }).sort({ price: 1 }).exec();
  }

  async updatePlan(id: string, updateDto: UpdateSubscriptionPlanDto) {
    try {
      const updatedPlan = await this.planModel
        .findByIdAndUpdate(id, updateDto, { returnDocument: 'after' })
        .exec();
      if (!updatedPlan) throw new NotFoundException('Subscription plan not found');
      return updatedPlan;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('A subscription plan with this name already exists');
      }
      throw error;
    }
  }

  async deletePlan(id: string) {
    const result = await this.planModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Subscription plan not found');
    return result;
  }

  async subscribeUser(userId: string, planId: string) {
    const plan = await this.planModel.findById(planId).exec();
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Active subscription plan not found');
    }
    return this.userService.updateSubscription(userId, plan._id.toString(), plan.durationInDays);
  }
}
