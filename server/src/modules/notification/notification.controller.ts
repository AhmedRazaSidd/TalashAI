import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PaginationDto } from '../chat/dto/pagination.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Notifications (Mobile)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get current user notifications' })
  async getMyNotifications(@Request() req, @Query() paginationDto: PaginationDto) {
    const result = await this.notificationService.getMyNotifications(req.user.userId, paginationDto);
    return {
      success: true,
      message: 'Notifications retrieved successfully',
      ...result,
    };
  }
}
