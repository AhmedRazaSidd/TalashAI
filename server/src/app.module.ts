// Root module of the application
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { FaqModule } from './modules/faq/faq.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { FeedbackReportModule } from './modules/feedback-report/feedback-report.module';
import { BookmarkModule } from './modules/bookmark/bookmark.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SubscriptionPlanModule } from './modules/subscription-plan/subscription-plan.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make env variables accessible globally
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        dbName: 'talash',
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    CloudinaryModule,
    FaqModule,
    AppConfigModule,
    ChatModule,
    NotificationModule,
    FeedbackReportModule,
    BookmarkModule,
    AnalyticsModule,
    SubscriptionPlanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
