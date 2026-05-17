import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bookmark, BookmarkDocument } from './schema/bookmark.schema';
import { PaginationDto } from '../chat/dto/pagination.dto';

@Injectable()
export class BookmarkService {
  constructor(
    @InjectModel(Bookmark.name) private bookmarkModel: Model<BookmarkDocument>,
  ) {}

  async createBookmark(userId: string, messageId: string) {
    try {
      const newBookmark = new this.bookmarkModel({ userId, messageId });
      return await newBookmark.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Message is already bookmarked');
      }
      throw error;
    }
  }

  async getMyBookmarks(userId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const query: any = { userId };
    const [data, total] = await Promise.all([
      this.bookmarkModel
        .find(query)
        .populate('messageId') // Assuming 'Message' model is registered in the module where it's used
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookmarkModel.countDocuments(query),
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

  async removeBookmark(userId: string, bookmarkId: string) {
    const query: any = { _id: bookmarkId, userId };
    const result = await this.bookmarkModel.findOneAndDelete(query).exec();
    if (!result) {
      throw new NotFoundException('Bookmark not found or you do not have permission to delete it');
    }
    return result;
  }
}
