import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/schema/user.schema';
import { ChatSession, ChatSessionDocument } from '../chat/schema/chat-session.schema';
import { Message, MessageDocument } from '../chat/schema/message.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ChatSession.name) private sessionModel: Model<ChatSessionDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async getDashboardMetrics() {
    const [totalUsers, totalSessions, totalMessages] = await Promise.all([
      this.userModel.countDocuments(),
      this.sessionModel.countDocuments(),
      this.messageModel.countDocuments(),
    ]);

    // Calculate start of the day 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Messages per day for the last 7 days
    const activityGraph = await this.messageModel.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 }, // Sort by date ascending
      },
    ]);

    // Get voice vs text ratio
    const typeDistribution = await this.messageModel.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalUsers,
      totalSessions,
      totalMessages,
      activityGraph,
      typeDistribution,
    };
  }
}
