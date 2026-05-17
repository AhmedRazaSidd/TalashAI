import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('App Config (Public)')
@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get public app configuration' })
  async getPublicConfig() {
    const config = await this.appConfigService.getPublicConfig();
    return {
      success: true,
      message: 'App config retrieved successfully',
      data: config,
    };
  }
}
