import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { PaginationDto } from '../chat/dto/pagination.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Bookmarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) { }

  @Post()
  @ApiOperation({ summary: 'Bookmark a message' })
  async createBookmark(@Request() req, @Body() createBookmarkDto: CreateBookmarkDto) {
    const result = await this.bookmarkService.createBookmark(req.user.userId, createBookmarkDto.messageId);
    return {
      success: true,
      message: 'Message bookmarked successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get your bookmarked messages' })
  async getBookmarks(@Request() req, @Query() paginationDto: PaginationDto) {
    const result = await this.bookmarkService.getMyBookmarks(req.user.userId, paginationDto);
    return {
      success: true,
      message: 'Bookmarks retrieved successfully',
      ...result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a bookmark' })
  async removeBookmark(@Request() req, @Param('id') id: string) {
    await this.bookmarkService.removeBookmark(req.user.userId, id);
    return {
      success: true,
      message: 'Bookmark removed successfully',
      data: null,
    };
  }
}
