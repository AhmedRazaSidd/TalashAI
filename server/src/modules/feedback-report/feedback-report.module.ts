import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema } from './schema/feedback.schema';
import { Report, ReportSchema } from './schema/report.schema';
import { FeedbackReportService } from './feedback-report.service';
import { FeedbackReportController } from './feedback-report.controller';
import { AdminFeedbackReportController } from './admin-feedback-report.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: Report.name, schema: ReportSchema },
    ]),
  ],
  controllers: [FeedbackReportController, AdminFeedbackReportController],
  providers: [FeedbackReportService],
  exports: [FeedbackReportService],
})
export class FeedbackReportModule {}
