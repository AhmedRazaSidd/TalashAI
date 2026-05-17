import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schema/notification.schema';
import { SendNotificationDto } from './dto/send-notification.dto';
import { FirebaseService } from './firebase.service';
import { PaginationDto } from '../chat/dto/pagination.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly firebaseService: FirebaseService,
  ) {}

  async sendNotification(sendDto: SendNotificationDto) {
    if (sendDto.targetType === 'user' && !sendDto.userId) {
      throw new BadRequestException('userId is required when targetType is "user"');
    }

    // 1. Send via Firebase
    const success = await this.firebaseService.sendPushNotification(
      sendDto.title,
      sendDto.body,
      sendDto.targetType === 'user' ? sendDto.userId : undefined,
    );

    // 2. Save history in DB
    const newNotification = new this.notificationModel({
      ...sendDto,
      status: success ? 'sent' : 'failed',
    });
    
    return newNotification.save();
  }

  async getMyNotifications(userId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    // We fetch notifications targeted specifically to the user OR targeted to 'all'
    const query: any = {
      $or: [
        { targetType: 'all' },
        { targetType: 'user', userId: new Types.ObjectId(userId) },
      ],
    };

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query),
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

  async getAdminHistory(paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.notificationModel
        .find()
        .populate('userId', 'name phone_number')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(),
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
}
