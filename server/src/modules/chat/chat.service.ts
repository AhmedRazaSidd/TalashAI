import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatSession, ChatSessionDocument } from './schema/chat-session.schema';
import { Message, MessageDocument } from './schema/message.schema';
import { Category, CategoryDocument } from './schema/category.schema';
import { PaginationDto, CursorPaginationDto } from './dto/pagination.dto';
import { AdminFilterDto } from './dto/admin-filter.dto';

// Ordered list of all pipeline agents. Used by the workflow orchestrator.
export const AGENT_SEQUENCE = [
  'CaseListener',
  'CaseClassifier',
  'QuestioningAgent',
  'RightsAnalyzer',
  'DocumentChecker',
  'ActionPlanner',
  'MisguideDetector',
  'PdfFormatter',
] as const;

export type AgentName = typeof AGENT_SEQUENCE[number];

import { AiService } from './ai.service';
import { UserService } from '../user/user.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatSession.name) private sessionModel: Model<ChatSessionDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private aiService: AiService,
    private userService: UserService,
  ) { }

  async createSession(userId: string, category: string, title?: string) {
    const sessionTitle = title || `${category} Case - ${new Date().toLocaleDateString()}`;
    const newSession = new this.sessionModel({ userId, title: sessionTitle, category });
    const savedSession = await newSession.save();

    // Automatically send the first greeting message personalized for the user!
    try {
      const user = await this.userService.findById(userId);
      const userName = user?.name || 'Client';

      const greetingMessage = `Hello ${userName}, I’m Talash AI, your legal assistant. I see your case relates to ${category}. Please share the details so I can assist you further.`;

      await this.saveAssistantMessage(savedSession._id.toString(), userId, greetingMessage);
    } catch (err) {
      console.error('Failed to automatically send first personalized greeting:', err);
    }

    return savedSession;
  }

  async updateSession(sessionId: string, updateDto: any) {
    const session = await this.sessionModel.findByIdAndUpdate(sessionId, updateDto, { returnDocument: 'after' }).exec();
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessionById(sessionId: string, requestingUserId: string) {
    // Allow access if: the user owns the session (victim) OR they are the assigned lawyer
    const session = await this.sessionModel.findOne({
      _id: sessionId as any,
      $or: [
        { userId: requestingUserId as any },
        { lawyerId: requestingUserId as any },
      ],
    }).exec();
    if (!session) throw new NotFoundException('Session not found or access denied');
    return session;
  }

  async getAvailableSessions(paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    // Unclaimed = active sessions with no lawyer assigned
    const query = { status: 'active', lawyerId: { $exists: false } };

    const [data, total] = await Promise.all([
      this.sessionModel.find(query as any)
        .populate('userId', 'name city state gender')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.sessionModel.countDocuments(query as any),
    ]);

    return {
      data,
      meta: { total, page, limit, hasNext: total > skip + limit },
    };
  }

  async saveUserMessage(sessionId: string, userId: string, content: string, type: string = 'text', role: string = 'user') {
    const newMessage = new this.messageModel({
      sessionId,
      userId,
      role,
      type,
      content,
    });
    return newMessage.save();
  }

  async saveAttachmentMessage(sessionId: string, userId: string, fileUrl: string, fileName: string, role: string = 'user') {
    const newMessage = new this.messageModel({
      sessionId,
      userId,
      role,
      type: 'attachment',
      content: fileName,
      fileUrl,
    });
    return newMessage.save();
  }

  async saveAssistantMessage(
    sessionId: string,
    userId: string,
    content: string,
    type: string = 'text',
    responseMode: string = 'text',
    audioUrl: string | null = null
  ) {
    const newMessage = new this.messageModel({
      sessionId,
      userId,
      role: 'assistant',
      type,
      content,
      responseMode,
      audioUrl,
    });
    return newMessage.save();
  }

  // Mobile: Get user sessions (offset pagination)
  async getUserSessions(userId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const query: any = { userId };
    const [data, total] = await Promise.all([
      this.sessionModel
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.sessionModel.countDocuments(query),
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

  // Mobile: Get session messages (cursor pagination)
  async getSessionMessages(userId: string, sessionId: string, cursorDto: CursorPaginationDto) {
    // Allow access if: user owns the session OR they are the assigned lawyer
    const session = await this.sessionModel.findOne({
      _id: sessionId,
      $or: [{ userId }, { lawyerId: userId }],
    } as any).exec();
    if (!session) {
      throw new NotFoundException('Session not found or access denied');
    }

    const { cursor, limit = 30 } = cursorDto;
    const query: any = { sessionId };

    // If cursor is provided, fetch messages older than the cursor (assuming descending order)
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const messages = await this.messageModel
      .find(query)
      .sort({ _id: -1 }) // Newest first
      .limit(limit)
      .exec();

    const hasNext = messages.length === limit;
    const nextCursor = hasNext ? messages[messages.length - 1]._id.toString() : null;

    return {
      data: messages.reverse(), // Send chronological order to client
      meta: {
        limit,
        hasNext,
        nextCursor,
      },
    };
  }

  // Admin: Get all sessions with filters (offset pagination)
  async getAllSessionsAdmin(filterDto: AdminFilterDto) {
    const { page = 1, limit = 20, userId, startDate, endDate } = filterDto;
    const skip = (page - 1) * limit;
    const query: any = {};

    if (userId) query.userId = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(query)
        .populate('userId', 'name phone_number') // Get user basic info
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.sessionModel.countDocuments(query),
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

  // Admin: Get all messages of any session
  async getSessionMessagesAdmin(sessionId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 50 } = paginationDto;
    const skip = (page - 1) * limit;

    const query: any = { sessionId };
    const [data, total] = await Promise.all([
      this.messageModel
        .find(query)
        .sort({ createdAt: 1 }) // Chronological order
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments(query),
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

  async getSessionMedia(sessionId: string) {
    // Return all messages that are attachments, voice, or contain a URL in content
    const query: any = {
      sessionId,
      $or: [
        { type: 'attachment' },
        { type: 'voice' },
        { fileUrl: { $ne: null } },
        { audioUrl: { $ne: null } }
      ]
    };

    const media = await this.messageModel.find(query).sort({ createdAt: -1 }).exec();

    return media;
  }

  async toggleBookmark(messageId: string, userId: string) {
    const query: any = { _id: messageId, userId };
    const message = await this.messageModel.findOne(query);
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    message.isBookmarked = !message.isBookmarked;
    return message.save();
  }

  async getSessionBookmarks(sessionId: string, userId: string) {
    const query: any = { sessionId, userId, isBookmarked: true };
    return this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateMessageStatus(messageId: string, status: string) {
    return this.messageModel.findByIdAndUpdate(messageId, { status }, { returnDocument: 'after' });
  }

  async claimSession(sessionId: string, lawyerId: string) {
    return this.sessionModel.findByIdAndUpdate(
      sessionId,
      {
        lawyerId,
        status: 'with_lawyer'
      },
      { returnDocument: 'after' }
    );
  }

  async generateSessionSummary(sessionId: string) {
    const messages = await this.messageModel.find({ sessionId: sessionId as any }).sort({ createdAt: 1 }).exec();
    const history = messages.map(m => ({
      role: m.role,
      content: m.content
    }));
    return this.aiService.summarizeSession(history);
  }
  async getAllCategories() {
    return this.categoryModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  // ──────────────────────────────────────────────────────
  // Workflow State Helpers
  // ──────────────────────────────────────────────────────

  /**
   * Returns the current workflow state for a session.
   * If the session has never run a pipeline, current_agent will be null
   * and waiting_for_user will be false.
   */
  async getWorkflowState(sessionId: string) {
    const session = await this.sessionModel
      .findById(sessionId)
      .select('current_agent current_step waiting_for_user collected_context')
      .exec();
    if (!session) throw new NotFoundException('Session not found');
    return {
      current_agent: session.current_agent ?? null,
      current_step: session.current_step ?? 0,
      waiting_for_user: session.waiting_for_user ?? false,
      collected_context: session.collected_context ?? {},
    };
  }

  /**
   * Returns the name of the agent currently running (or null if none).
   */
  async getCurrentAgent(sessionId: string): Promise<AgentName | null> {
    const state = await this.getWorkflowState(sessionId);
    return (state.current_agent as AgentName) ?? null;
  }

  /**
   * Advances the workflow to the next agent in AGENT_SEQUENCE.
   * If we are already on the last agent, sets current_agent to null
   * (pipeline complete). Resets waiting_for_user to false.
   */
  async moveToNextAgent(sessionId: string): Promise<AgentName | null> {
    const state = await this.getWorkflowState(sessionId);
    const currentIdx = AGENT_SEQUENCE.indexOf(state.current_agent as AgentName);
    const nextIdx = currentIdx + 1;
    const nextAgent = nextIdx < AGENT_SEQUENCE.length ? AGENT_SEQUENCE[nextIdx] : null;

    await this.sessionModel.findByIdAndUpdate(sessionId, {
      current_agent: nextAgent,
      current_step: nextAgent ? nextIdx + 1 : AGENT_SEQUENCE.length,
      waiting_for_user: false,
    });

    return nextAgent;
  }

  /**
   * Merges a key/value answer into the session's collected_context.answers.
   * Pass the agent name as `agentKey` to namespace answers cleanly.
   */
  async saveAgentAnswer(
    sessionId: string,
    agentKey: string,
    answer: any,
  ): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      $set: { [`collected_context.answers.${agentKey}`]: answer },
    });
  }

  /**
   * Updates specific keys inside collected_context.
   */
  async updateWorkflowContext(
    sessionId: string,
    updates: Record<string, any>,
  ): Promise<void> {
    const updateObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      updateObj[`collected_context.${key}`] = val;
    }
    await this.sessionModel.findByIdAndUpdate(sessionId, { $set: updateObj });
  }

  /**
   * Initialises the workflow for a fresh pipeline run.
   * Sets current_agent to the first agent, resets step counter to 1
   * and clears any stale collected_context.
   */
  async initWorkflow(sessionId: string): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      current_agent: AGENT_SEQUENCE[0],
      current_step: 1,
      waiting_for_user: false,
      collected_context: {
        user_problem: null,
        category: null,
        answers: {},
        documents: [],
        risk_flags: [],
        generated_outputs: null,
      },
    });
  }

  /**
   * Marks the session as waiting for user input in the middle of a pipeline.
   * The gateway will check this flag before deciding whether to resume or restart.
   */
  async setWaitingForUser(sessionId: string, waiting: boolean): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, { waiting_for_user: waiting });
  }

  /**
   * Marks the pipeline as fully complete: clears agent pointer and waiting flag.
   */
  async completeWorkflow(sessionId: string): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      current_agent: null,
      waiting_for_user: false,
    });
  }
}

