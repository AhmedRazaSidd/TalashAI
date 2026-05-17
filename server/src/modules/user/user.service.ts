import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, Review } from './schema/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AdminFilterUserDto } from './dto/admin-filter-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ChatSession, ChatSessionDocument } from '../chat/schema/chat-session.schema';
import { Message, MessageDocument } from '../chat/schema/message.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Review.name) private reviewModel: Model<any>,
    @InjectModel(ChatSession.name) private sessionModel: Model<ChatSessionDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async create(createUserDto: any): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findByPhoneNumber(phone_number: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone_number }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).populate('subscriptionPlanId').exec();
  }

  async updateRefreshToken(id: string, refreshToken: string | null) {
    return this.userModel.findByIdAndUpdate(id, { refreshToken }).exec();
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto) {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateProfileDto, { returnDocument: 'after' })
      .select('-password')
      .exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  async updateSettings(id: string, updateSettingsDto: UpdateSettingsDto) {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateSettingsDto, { returnDocument: 'after' })
      .select('-password')
      .exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  async updateAvatar(id: string, avatarUrl: string) {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { avatar: avatarUrl }, { returnDocument: 'after' })
      .select('-password')
      .exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  async findAllWithFcmTokens(): Promise<string[]> {
    const users = await this.userModel
      .find({ fcmToken: { $nin: [null, ''] } })
      .select('fcmToken')
      .exec();
    return users.map((u) => u.fcmToken);
  }

  // ---- Admin Methods ----

  async findAllUsers(filterDto: AdminFilterUserDto) {
    const { page = 1, limit = 20, phone_number, name, role } = filterDto;
    const skip = (page - 1) * limit;
    
    const query: any = {};
    if (phone_number) query.phone_number = new RegExp(phone_number, 'i');
    if (name) query.name = new RegExp(name, 'i');
    if (role) query.role = role;

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -refreshToken') // Exclude sensitive fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(query),
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

  async updateUserAdmin(id: string, updateDto: AdminUpdateUserDto) {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateDto, { returnDocument: 'after' })
      .select('-password -refreshToken')
      .exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  async deleteUser(id: string) {
    // 1. Delete all messages in their sessions
    const sessions = await this.sessionModel.find({ userId: id as any }).select('_id').exec();
    const sessionIds = sessions.map(s => s._id);
    await this.messageModel.deleteMany({ sessionId: { $in: sessionIds } as any });

    // 2. Delete the sessions
    await this.sessionModel.deleteMany({ userId: id as any });

    // 3. Delete reviews written by/for them
    await this.reviewModel.deleteMany({ 
      $or: [
        { userId: id as any }, 
        { lawyerId: id as any }
      ] 
    });

    // 4. Finally delete the user
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  // ---- Lawyer Marketplace Methods ----

  async findLawyers(sort: string, specialization: string, search: string) {
    const query: any = { role: 'lawyer', isVerified: true };
    if (specialization) query.specializations = specialization;
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { specializations: new RegExp(search, 'i') },
        { lawyerDescription: new RegExp(search, 'i') }
      ];
    }

    let sortOption: any = { createdAt: -1 };
    if (sort === 'rating') sortOption = { rating: -1 };
    if (sort === 'experience') sortOption = { experienceYears: -1 };
    if (sort === 'cases') sortOption = { casesSolved: -1 };

    return this.userModel.find(query).sort(sortOption).select('-password -refreshToken').exec();
  }

  async getLawyerProfile(id: string) {
    const lawyer = await this.userModel.findById(id).select('-password -refreshToken').exec();
    if (!lawyer) throw new NotFoundException('Lawyer not found');
    
    const reviews = await this.reviewModel.find({ lawyerId: id }).sort({ createdAt: -1 }).limit(10).exec();
    return { ...lawyer.toObject(), reviews };
  }

  async addReview(userId: string, lawyerId: string, rating: number, comment: string) {
    const review = new this.reviewModel({ userId, lawyerId, rating, comment });
    await review.save();

    // Recalculate lawyer rating
    const allReviews = await this.reviewModel.find({ lawyerId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    
    await this.userModel.findByIdAndUpdate(lawyerId, { rating: avgRating });
    return review;
  }

  async changePassword(id: string, oldPassword: string, newPassword: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(oldPassword, user.password || '');
    if (!isMatch) throw new BadRequestException('Incorrect current password');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(id, { password: hashedPassword });
    return { success: true, message: 'Password changed successfully' };
  }

  async updateSubscription(userId: string, planId: string, durationInDays: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationInDays);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          subscriptionPlanId: planId as any,
          subscriptionExpiresAt: expiresAt,
          subscriptionStatus: 'active',
        },
        { returnDocument: 'after' },
      )
      .populate('subscriptionPlanId')
      .select('-password')
      .exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }
}



