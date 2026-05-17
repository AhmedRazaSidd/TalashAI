import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { FeedbackReportService } from './feedback-report.service';
import { UpdateReportStatusDto } from './dto/update-report.dto';
import { PaginationDto } from '../chat/dto/pagination.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Feedback & Reports (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminFeedbackReportController {
  constructor(private readonly feedbackReportService: FeedbackReportService) {}

  @Get('feedback')
  @ApiOperation({ summary: 'Get all user feedback' })
  async getAllFeedback(@Query() paginationDto: PaginationDto) {
    const result = await this.feedbackReportService.getFeedback(paginationDto);
    return {
      success: true,
      message: 'Feedback retrieved successfully',
      ...result,
    };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get all reported content' })
  async getAllReports(@Query() paginationDto: PaginationDto) {
    const result = await this.feedbackReportService.getReports(paginationDto);
    return {
      success: true,
      message: 'Reports retrieved successfully',
      ...result,
    };
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Update report status' })
  async updateReportStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateReportStatusDto,
  ) {
    const result = await this.feedbackReportService.updateReportStatus(id, updateDto.status);
    return {
      success: true,
      message: 'Report status updated successfully',
      data: result,
    };
  }
}
