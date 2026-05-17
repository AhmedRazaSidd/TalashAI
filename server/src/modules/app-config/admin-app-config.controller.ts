import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('App Config (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/config')
export class AdminAppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get all app configurations' })
  async getAllConfig() {
    const config = await this.appConfigService.getAllConfig();
    return {
      success: true,
      message: 'App configs retrieved successfully',
      data: config,
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update one or multiple app configurations' })
  async updateConfig(@Body() updateConfigDto: UpdateConfigDto, @Request() req) {
    const updatedConfig = await this.appConfigService.updateConfig(
      updateConfigDto,
      req.user.userId,
    );
    return {
      success: true,
      message: 'App config updated successfully',
      data: updatedConfig,
    };
  }
}
