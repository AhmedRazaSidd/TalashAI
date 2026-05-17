import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig, AppConfigDocument } from './schema/app-config.schema';

@Injectable()
export class AppConfigService implements OnModuleInit {
  constructor(
    @InjectModel(AppConfig.name) private appConfigModel: Model<AppConfigDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultConfig();
  }

  private async seedDefaultConfig() {
    const defaultConfigs = [
      { key: 'ai_system_prompt', value: 'You are a helpful AI assistant.' },
      { key: 'max_messages_per_day', value: 100 },
      { key: 'max_voice_per_day', value: 50 },
      { key: 'maintenance_mode', value: false },
      { key: 'force_update', value: false },
      { key: 'min_app_version', value: '1.0.0' },
    ];

    for (const config of defaultConfigs) {
      const exists = await this.appConfigModel.findOne({ key: config.key });
      if (!exists) {
        await this.appConfigModel.create(config);
      }
    }
  }

  async getPublicConfig() {
    const keys = ['maintenance_mode', 'force_update', 'min_app_version'];
    const configs = await this.appConfigModel.find({ key: { $in: keys } }).exec();
    
    // Convert array of documents to a simple object { key: value }
    const configObject: Record<string, any> = {};
    for (const config of configs) {
      configObject[config.key] = config.value;
    }
    return configObject;
  }

  async getAllConfig() {
    const configs = await this.appConfigModel.find().exec();
    const configObject: Record<string, any> = {};
    for (const config of configs) {
      configObject[config.key] = config.value;
    }
    return configObject;
  }

  async updateConfig(updates: Record<string, any>, updatedBy: string) {
    const updatedKeys: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const result = await this.appConfigModel.findOneAndUpdate(
          { key },
          { value, updatedBy },
          { returnDocument: 'after' },
        );
        if (result) {
          updatedKeys.push(result);
        }
      }
    }
    return this.getAllConfig(); // Return fresh config after update
  }
}
