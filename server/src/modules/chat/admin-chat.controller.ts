import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PaginationDto } from './dto/pagination.dto';
import { AdminFilterDto } from './dto/admin-filter.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Chat (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/chats')
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions (filterable)' })
  async getAllSessions(@Query() filterDto: AdminFilterDto) {
    const result = await this.chatService.getAllSessionsAdmin(filterDto);
    return {
      success: true,
      message: 'Sessions retrieved successfully',
      ...result,
    };
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get messages for any session (Admin)' })
  async getSessionMessages(
    @Param('id') sessionId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const result = await this.chatService.getSessionMessagesAdmin(sessionId, paginationDto);
    return {
      success: true,
      message: 'Messages retrieved successfully',
      ...result,
    };
  }
}
