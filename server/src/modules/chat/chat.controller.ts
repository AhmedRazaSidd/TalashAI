import { Controller, Get, Param, Query, UseGuards, Request, Post, Body, Patch, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';
import { PaginationDto, CursorPaginationDto } from './dto/pagination.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Chat (Mobile)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly aiService: AiService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get all dynamic legal categories' })
  async getCategories() {
    const categories = await this.chatService.getAllCategories();
    return { success: true, data: categories };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get current user chat sessions' })
  async getSessions(@Request() req, @Query() paginationDto: PaginationDto) {
    const result = await this.chatService.getUserSessions(req.user.userId, paginationDto);
    return {
      success: true,
      message: 'Sessions retrieved successfully',
      ...result,
    };
  }

  @Get('sessions/available')
  @ApiOperation({ summary: 'Get all unclaimed active sessions (Lawyer marketplace)' })
  async getAvailableSessions(@Request() req, @Query() paginationDto: PaginationDto) {
    const result = await this.chatService.getAvailableSessions(paginationDto);
    return {
      success: true,
      message: 'Available sessions retrieved successfully',
      ...result,
    };
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a single session by ID' })
  async getSession(@Request() req, @Param('id') sessionId: string) {
    const session = await this.chatService.getSessionById(sessionId, req.user.userId);
    return { success: true, data: session };
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get messages for a specific session (Cursor Paginated)' })
  async getSessionMessages(
    @Request() req,
    @Param('id') sessionId: string,
    @Query() cursorDto: CursorPaginationDto,
  ) {
    const result = await this.chatService.getSessionMessages(req.user.userId, sessionId, cursorDto);
    return {
      success: true,
      message: 'Messages retrieved successfully',
      ...result,
    };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session with a category' })
  async createSession(
    @Request() req,
    @Body() body: { category: string; title?: string },
  ) {
    const session = await this.chatService.createSession(req.user.userId, body.category, body.title);
    return {
      success: true,
      message: 'Session created successfully',
      data: session,
    };
  }

  @Get('sessions/:id/media')
  @ApiOperation({ summary: 'Get all media and attachments for a specific session' })
  async getSessionMedia(
    @Request() req,
    @Param('id') sessionId: string,
  ) {
    const media = await this.chatService.getSessionMedia(sessionId);
    return {
      success: true,
      message: 'Media retrieved successfully',
      data: media,
    };
  }

  @Patch('messages/:id/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark status for a message' })
  async toggleBookmark(
    @Request() req,
    @Param('id') messageId: string,
  ) {
    const message = await this.chatService.toggleBookmark(messageId, req.user.userId);
    return {
      success: true,
      message: 'Bookmark toggled successfully',
      data: message,
    };
  }

  @Get('sessions/:id/bookmarks')
  @ApiOperation({ summary: 'Get all bookmarked messages for a specific session' })
  async getSessionBookmarks(
    @Request() req,
    @Param('id') sessionId: string,
  ) {
    const bookmarks = await this.chatService.getSessionBookmarks(sessionId, req.user.userId);
    return {
      success: true,
      message: 'Bookmarks retrieved successfully',
      data: bookmarks,
    };
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update chat session (category, title, status)' })
  async updateSession(
    @Request() req,
    @Param('id') sessionId: string,
    @Body() updateDto: { category?: string; title?: string; status?: string }
  ) {
    const session = await this.chatService.updateSession(sessionId, updateDto);
    return { success: true, data: session };
  }

  @Get('sessions/:id/summary')
  @ApiOperation({ summary: 'Get AI generated summary of a chat session' })
  async getSessionSummary(@Param('id') sessionId: string) {
    const summary = await this.chatService.generateSessionSummary(sessionId);
    return { success: true, data: { summary } };
  }

  @Post('sessions/:id/takeover')
  @ApiOperation({ summary: 'Lawyer takes over from AI intake' })
  async takeOverSession(@Param('id') sessionId: string) {
    const summary = await this.chatService.generateSessionSummary(sessionId);
    await this.chatService.updateSession(sessionId, { status: 'with_lawyer' });
    return { success: true, data: { summary } };
  }

  @Post('sessions/:id/attachments')
  @ApiOperation({ summary: 'Upload file attachment to a session' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  async uploadAttachment(
    @Request() req,
    @Param('id') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    
    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(file, 'attachments');
    const fileUrl = (uploadResult as any).secure_url;
    
    // Save to database
    const message = await this.chatService.saveAttachmentMessage(sessionId, req.user.userId, fileUrl, file.originalname, req.user.role);
    
    // Trigger AI OCR Analysis in the background
    this.aiService.analyzeDocument(fileUrl, sessionId, req.user.userId, file.originalname).then(async (analysis) => {
       const savedMsg = await this.chatService.saveAssistantMessage(
         sessionId, 
         req.user.userId, 
         `AI Document Analysis of "${file.originalname}":\n\n${analysis}`,
         'text'
       );

       // Emit to Socket.io connection in real-time so it displays instantly on client
       const responseText = `AI Document Analysis of "${file.originalname}":\n\n${analysis}`;
       this.chatGateway.emitToSession(sessionId, 'message_done', {
         fullMessage: responseText,
         sessionId,
         messageId: savedMsg._id.toString(),
         audioUrl: null,
       });
    }).catch(err => console.error('Background OCR failed', err));

    return {
      success: true,
      message: 'Attachment uploaded successfully',
      data: message,
    };
  }

  @Post('sessions/:id/claim')
  @ApiOperation({ summary: 'Lawyer claims a chat session' })
  async claimSession(@Request() req, @Param('id') sessionId: string) {
    if (req.user.role !== 'lawyer') {
      throw new ForbiddenException('Only lawyers can claim sessions');
    }
    const session = await this.chatService.claimSession(sessionId, req.user.userId);
    return {
      success: true,
      message: 'Session claimed successfully',
      data: session,
    };
  }
}
