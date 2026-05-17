import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { FeedbackReportService } from './feedback-report.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Feedback & Reports (Mobile)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FeedbackReportController {
  constructor(private readonly feedbackReportService: FeedbackReportService) {}

  @Post('feedback')
  @ApiOperation({ summary: 'Submit application feedback' })
  async submitFeedback(@Request() req, @Body() createFeedbackDto: CreateFeedbackDto) {
    const result = await this.feedbackReportService.createFeedback(req.user.userId, createFeedbackDto);
    return {
      success: true,
      message: 'Feedback submitted successfully',
      data: result,
    };
  }

  @Post('reports')
  @ApiOperation({ summary: 'Report a user or a message' })
  async submitReport(@Request() req, @Body() createReportDto: CreateReportDto) {
    const result = await this.feedbackReportService.createReport(req.user.userId, createReportDto);
    return {
      success: true,
      message: 'Report submitted successfully',
      data: result,
    };
  }
}
