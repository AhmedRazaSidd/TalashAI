import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Feedback, FeedbackDocument } from './schema/feedback.schema';
import { Report, ReportDocument } from './schema/report.schema';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { PaginationDto } from '../chat/dto/pagination.dto';

@Injectable()
export class FeedbackReportService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
  ) {}

  // ---- Mobile/User Actions ----

  async createFeedback(userId: string, createFeedbackDto: CreateFeedbackDto) {
    const feedback = new this.feedbackModel({
      userId,
      ...createFeedbackDto,
    });
    return feedback.save();
  }

  async createReport(reporterId: string, createReportDto: CreateReportDto) {
    const report = new this.reportModel({
      reporterId,
      ...createReportDto,
    });
    return report.save();
  }

  // ---- Admin Actions ----

  async getFeedback(paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.feedbackModel
        .find()
        .populate('userId', 'name phone_number')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.feedbackModel.countDocuments(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        hasNext: total > skip + limit,
      },
    };
  }

  async getReports(paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.reportModel
        .find()
        .populate('reporterId', 'name phone_number')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        hasNext: total > skip + limit,
      },
    };
  }

  async updateReportStatus(reportId: string, status: string) {
    const updatedReport = await this.reportModel
      .findByIdAndUpdate(reportId, { status }, { returnDocument: 'after' })
      .exec();
      
    if (!updatedReport) {
      throw new NotFoundException('Report not found');
    }
    return updatedReport;
  }
}
