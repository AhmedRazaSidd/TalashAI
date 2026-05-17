import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig, AppConfigSchema } from './schema/app-config.schema';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';
import { AdminAppConfigController } from './admin-app-config.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: AppConfig.name, schema: AppConfigSchema }])],
  controllers: [AppConfigController, AdminAppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
