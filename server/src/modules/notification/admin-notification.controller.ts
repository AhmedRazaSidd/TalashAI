import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PaginationDto } from '../chat/dto/pagination.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Notifications (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a push notification' })
  async sendNotification(@Body() sendDto: SendNotificationDto) {
    const result = await this.notificationService.sendNotification(sendDto);
    return {
      success: true,
      message: 'Notification processing completed',
      data: result,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get notification history' })
  async getHistory(@Query() paginationDto: PaginationDto) {
    const result = await this.notificationService.getAdminHistory(paginationDto);
    return {
      success: true,
      message: 'History retrieved successfully',
      ...result,
    };
  }
}
