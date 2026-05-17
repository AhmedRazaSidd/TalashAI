import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ChatSession, ChatSessionSchema } from './schema/chat-session.schema';
import { Message, MessageSchema } from './schema/message.schema';
import { Category, CategorySchema } from './schema/category.schema';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AdminChatController } from './admin-chat.controller';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';
import { AppConfigModule } from '../app-config/app-config.module';
import { UserModule } from '../user/user.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    HttpModule,
    JwtModule.register({}), // Secrets managed inside the guards/gateways
    AppConfigModule,
    UserModule,
    CloudinaryModule,
    NotificationModule,
  ],
  controllers: [ChatController, AdminChatController],
  providers: [ChatService, AiService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
