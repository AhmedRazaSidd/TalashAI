import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { NotificationService } from '../notification/notification.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  
  // For buffering live voice chunks (Mode B)
  private voiceBuffers: Map<string, Buffer[]> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationService: NotificationService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
      if (!authHeader) throw new Error('No token');
      
      const token = authHeader.split(' ')[1] || authHeader;
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) throw new Error('JWT_ACCESS_SECRET is not defined');

      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      (client as any).user = { userId: payload.sub, role: payload.role };
      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (err) {
      this.logger.error(`Connection failed for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Cleanup any lingering voice buffers for this client
    for (const key of this.voiceBuffers.keys()) {
      if (key.startsWith(client.id)) {
        this.voiceBuffers.delete(key);
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (data.sessionId) {
      client.join(data.sessionId);
      this.logger.log(`Client ${client.id} joined session ${data.sessionId}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string; content: string; type?: string },
  ) {
    const userId = (client as any).user.userId;
    const role = (client as any).user.role;
    let { sessionId, content, type } = data;

    let session;
    if (!sessionId) {
      session = await this.chatService.createSession(userId, 'General');
      sessionId = session._id.toString();
      client.join(sessionId as string);
      client.emit('session_created', { sessionId, title: session.title });
    } else {
      client.join(sessionId as string);
      // Fetch session to get category
      const sessions = await this.chatService.getUserSessions(userId, { limit: 100 });
      session = sessions.data.find(s => s._id.toString() === sessionId);
    }
    
    const category = session?.category || 'General';

    // Auto-Classification logic for new/general cases
    if (category === 'General' && content && typeof content === 'string' && content.length > 20) {
      const newCategory = await this.aiService.classifyCase(content);
      if (newCategory !== 'General') {
        await this.chatService.updateSession(sessionId as string, { category: newCategory });
        client.emit('session_updated', { sessionId, category: newCategory });
      }
    }

    await this.chatService.saveUserMessage(sessionId as string, userId, content as string, type || 'text', role);

    const historyParams = await this.chatService.getSessionMessages(userId, sessionId as string, { limit: 10 });
    const history = historyParams.data.map(m => ({
      role: m.role,
      content: m.content
    }));

    const media = await this.chatService.getSessionMedia(sessionId as string);
    const attachments = media.map(m => m.fileUrl).filter(url => !!url);

    try {
      const fullResponse = await this.aiService.streamTextResponse(sessionId as string, content as string, client, history, category as string, attachments, userId);
      
      const savedMsg = await this.chatService.saveAssistantMessage(
        sessionId as string,
        userId,
        fullResponse,
        'text',
        'text',
      );

      client.emit('message_done', { 
        fullMessage: fullResponse, 
        sessionId: sessionId as string,
        messageId: savedMsg._id 
      });

      // Send Push Notification
      this.notificationService.sendNotification({
        title: 'New Message from Talash AI',
        body: fullResponse.substring(0, 100) + '...',
        targetType: 'user',
        userId: userId,
      }).catch(err => this.logger.error('Failed to send push notification', err));

      // Mark user's message as read
      const userMessages = await this.chatService.getSessionMessages(userId, sessionId as string, { limit: 1 });
      if (userMessages.data.length > 0) {
        await this.chatService.updateMessageStatus(userMessages.data[0]._id.toString(), 'read');
      }
    } catch (error) {
      this.logger.error('Error handling send_message', error);
      client.emit('message_error', { error: 'Failed to process message', sessionId: sessionId as string });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('set_response_mode')
  async handleSetResponseMode(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mode: string },
  ) {
    const userId = (client as any).user.userId;
    if (data.mode === 'text' || data.mode === 'audio') {
      await this.userService.updateSettings(userId, { voiceResponseMode: data.mode });
      client.emit('response_mode_updated', { mode: data.mode });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('voice_message')
  async handleVoiceMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string; audioBase64: string },
  ) {
    const userId = (client as any).user.userId;
    const role = (client as any).user.role;
    let { sessionId, audioBase64 } = data;

    let session;
    if (!sessionId) {
      session = await this.chatService.createSession(userId, "General");
      sessionId = session._id.toString();
      client.join(sessionId as string);
      client.emit('session_created', { sessionId, title: session.title });
    } else {
      client.join(sessionId as string);
      // Fetch session to get category
      const sessions = await this.chatService.getUserSessions(userId, { limit: 100 });
      session = sessions.data.find(s => s._id.toString() === sessionId);
    }

    const category = session?.category || 'General';

    try {
      const buffer = Buffer.from(audioBase64, 'base64');
      // 1. Upload raw user audio to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadAudioBuffer(buffer);
      const userAudioUrl = (uploadResult as any).secure_url;

      // 2. Save user's voice message
      await this.chatService.saveUserMessage(sessionId as string, userId, userAudioUrl, 'voice', role);

      // 3. Get User Prefs & History
      const user = await this.userService.findById(userId);
      if (!user) throw new Error('User not found');
      
      const historyParams = await this.chatService.getSessionMessages(userId, sessionId as string, { limit: 10 });
      const history = historyParams.data.map(m => ({ role: m.role, content: m.content || m.audioUrl }));

      const media = await this.chatService.getSessionMedia(sessionId as string);
      const attachments = media.map(m => m.fileUrl).filter(url => !!url);

      // 4. Process Voice via AI Service
      const result = await this.aiService.processAudioMessage(
        sessionId as string,
        userAudioUrl,
        user.voiceResponseMode || 'text',
        client,
        history,
        category as string,
        attachments,
        userId,
      );

      // 5. Save Assistant Message
      const savedMsg = await this.chatService.saveAssistantMessage(
        sessionId as string,
        userId,
        result.text,
        result.audioUrl ? 'audio' : 'text', // Assistant responds with audio or text based on url presence
        user.voiceResponseMode,
        result.audioUrl || undefined
      );

      client.emit('message_done', { 
        fullMessage: result.text, 
        audioUrl: result.audioUrl,
        sessionId: sessionId as string,
        messageId: savedMsg._id 
      });

      // Send Push Notification
      this.notificationService.sendNotification({
        title: 'New Message from Talash AI',
        body: result.text.substring(0, 100) + '...',
        targetType: 'user',
        userId: userId,
      }).catch(err => this.logger.error('Failed to send push notification', err));

    } catch (error) {
      this.logger.error('Error handling voice_message', error);
      client.emit('message_error', { error: 'Failed to process voice message', sessionId: sessionId as string });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('voice_chunk')
  async handleVoiceChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string; audioChunk: Buffer; isLast: boolean },
  ) {
    const userId = (client as any).user.userId;
    let { sessionId, audioChunk, isLast } = data;
    
    // Since we need a sessionId to group chunks, create one immediately if none provided
    if (!sessionId) {
      const session = await this.chatService.createSession(userId, "Live Voice Chat");
      sessionId = session._id.toString();
      client.join(sessionId);
      client.emit('session_created', { sessionId, title: session.title });
    } else {
      client.join(sessionId as string);
    }

    const bufferKey = `${client.id}_${sessionId}`;
    let chunks = this.voiceBuffers.get(bufferKey) || [];
    
    if (audioChunk) {
      chunks.push(audioChunk);
      this.voiceBuffers.set(bufferKey, chunks);
    }

    if (isLast && chunks.length > 0) {
      // Concatenate all chunks into a single buffer
      const fullAudioBuffer = Buffer.concat(chunks);
      this.voiceBuffers.delete(bufferKey); // Clear buffer

      // Delegate processing to the standard voice_message flow
      await this.handleVoiceMessage(client, { sessionId, audioBase64: fullAudioBuffer.toString('base64') });
    }
  }

  emitToSession(sessionId: string, event: string, data: any) {
    if (this.server) {
      this.server.to(sessionId).emit(event, data);
    }
  }
}

