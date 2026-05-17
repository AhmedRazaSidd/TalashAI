// User module handles user-related functionality
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema, Review, ReviewSchema } from './schema/user.schema';
import { UserService } from './user.service';
import { ProfileController } from './profile.controller';
import { AdminUserController } from './admin-user.controller';
import { LawyersController } from './lawyers.controller';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { Category, CategorySchema } from '../chat/schema/category.schema';
import { ChatSession, ChatSessionSchema } from '../chat/schema/chat-session.schema';
import { Message, MessageSchema } from '../chat/schema/message.schema';
import { Faq, FaqSchema } from '../faq/schema/faq.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { SubscriptionPlan, SubscriptionPlanSchema } from '../subscription-plan/schema/subscription-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Category.name, schema: CategorySchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Faq.name, schema: FaqSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [ProfileController, AdminUserController, LawyersController, SeedController],
  providers: [UserService, SeedService],
  exports: [UserService],
})
export class UserModule {}
