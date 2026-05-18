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
import { ChatService, AGENT_SEQUENCE } from './chat.service';
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

    this.logger.log(`[Socket Receive] Received "send_message" event for session: ${sessionId || 'NEW_SESSION'} from user: ${userId}`);

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

    // ── Workflow Orchestration ─────────────────────────────────────────────
    // Read the persisted state BEFORE touching the pipeline.
    const workflowState = await this.chatService.getWorkflowState(sessionId as string);

    if (workflowState.waiting_for_user) {
      // The pipeline paused for input — store the reply and resume.
      this.logger.log(`[Workflow] Session ${sessionId} is resuming agent: ${workflowState.current_agent}`);
      client.emit('agent_stream', { trace: `▶️ Resuming ${workflowState.current_agent}...` });

      // Identify where to save the reply based on last_expected_input
      const lastExpectedInput = (workflowState.collected_context as any).answers?.last_expected_input || 'generic_reply';

      // Persist the incoming answer under collected_context.answers.[current_agent].[lastExpectedInput]
      await this.chatService.saveAgentAnswer(
        sessionId as string,
        `${workflowState.current_agent}.${lastExpectedInput}`,
        content,
      );

      // Clear the waiting flag so the pipeline can progress.
      await this.chatService.setWaitingForUser(sessionId as string, false);
    } else {
      // Fresh request — reset workflow and start from Agent 1.
      this.logger.log(`[Workflow] Session ${sessionId} starting a new pipeline run.`);
      await this.chatService.initWorkflow(sessionId as string);
    }

    try {
      await this.resumePipelineFromAgent(
        sessionId as string,
        content as string,
        client,
        history,
        category as string,
        attachments,
        userId,
      );

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

  /**
   * Orchestrates sequential execution of pipeline agents.
   * Runs the current agent, handles pauses for user input,
   * updates the session context, and recursively/iteratively triggers the next agent.
   */
  async resumePipelineFromAgent(
    sessionId: string,
    content: string,
    client: Socket,
    history: any[],
    category: string,
    attachments: string[],
    userId: string,
  ): Promise<void> {
    let freshState = await this.chatService.getWorkflowState(sessionId);
    let currentAgent: string | null = freshState.current_agent;

    while (currentAgent) {
      this.logger.log(`[Workflow Loop] Running agent ${currentAgent} for session: ${sessionId}`);

      // Emit real-time workflow progress to client
      const currentStep = freshState.current_step;
      const completedAgents = AGENT_SEQUENCE.slice(0, currentStep - 1);
      const remainingAgents = AGENT_SEQUENCE.slice(currentStep);
      const progressPercentage = Math.round(((currentStep - 1) / AGENT_SEQUENCE.length) * 100);

      client.emit('workflow_progress', {
        current_agent: currentAgent,
        current_step: currentStep,
        total_steps: AGENT_SEQUENCE.length,
        completed_agents: completedAgents,
        remaining_agents: remainingAgents,
        progress_percentage: progressPercentage,
      });

      // Call single agent
      const response = await this.aiService.streamTextResponse(
        sessionId,
        content,
        client,
        history,
        category,
        attachments,
        userId,
        freshState.collected_context,
        currentAgent,
      );

      // 1. Check if the agent paused for user input
      if (response && response.pause_for_user === true) {
        this.logger.log(`[Workflow Pause] Agent ${currentAgent} requested pause.`);

        // Save waiting state
        await this.chatService.setWaitingForUser(sessionId, true);

        // Store the expected field name so the gateway knows where to save the next response
        await this.chatService.saveAgentAnswer(sessionId, 'last_expected_input', response.expected_input);

        // Emit 'agent_question' socket event
        client.emit('agent_question', {
          question: response.question,
          expected_input: response.expected_input,
          agent: response.agent,
        });

        // Push a readable question text into chat trace
        client.emit('agent_stream', { chunk: `\n\n**${currentAgent}**: ${response.question}\n` });

        return; // HALT remaining loop execution, wait for next user reply!
      }

      // 2. Check if agent failed
      if (response && response.pipeline_status === 'failed') {
        this.logger.error(`[Workflow Error] Agent ${currentAgent} failed to execute: ${response.error}`);
        client.emit('message_error', { error: `Agent ${currentAgent} failed to execute.`, sessionId });
        return;
      }

      // 3. Agent succeeded! Save its outputs
      this.logger.log(`[Workflow Loop] Agent ${currentAgent} completed successfully.`);
      const partialOutput = response.final_output || {};

      // Save the output under its namespace (e.g. collected_context.answers.CaseListener)
      await this.chatService.saveAgentAnswer(sessionId, currentAgent, partialOutput);

      // Sync user_problem and category directly to context roots if extracted
      if (currentAgent === 'CaseListener' && partialOutput.cleaned_input) {
        await this.chatService.updateWorkflowContext(sessionId, { user_problem: partialOutput.cleaned_input });
      }
      if (currentAgent === 'CaseClassifier' && partialOutput.primary_category) {
        await this.chatService.updateWorkflowContext(sessionId, { category: partialOutput.primary_category });
      }

      // Move to next agent in sequence
      const nextAgent = await this.chatService.moveToNextAgent(sessionId);
      freshState = await this.chatService.getWorkflowState(sessionId);
      currentAgent = nextAgent;
    }

    // 4. Entire sequence completed!
    this.logger.log(`[Workflow Complete] All agents completed successfully for session: ${sessionId}`);

    const finalState = await this.chatService.getWorkflowState(sessionId);
    const pdfFormatterOutput = finalState.collected_context.answers?.PdfFormatter || {};

    // Save final generated outputs under generated_outputs
    await this.chatService.updateWorkflowContext(sessionId, { generated_outputs: pdfFormatterOutput });

    const fullResponse = "Case assessment has been successfully generated. Please check your dashboard below.";

    const savedMsg = await this.chatService.saveAssistantMessage(
      sessionId,
      userId,
      fullResponse,
      'text',
      'text',
    );

    this.logger.log(`[Socket Emit] Emitting "message_done" to client for session: ${sessionId}`);
    client.emit('message_done', {
      fullMessage: fullResponse,
      sessionId: sessionId,
      messageId: savedMsg._id
    });

    // Send Push Notification
    this.notificationService.sendNotification({
      title: 'New Message from Talash AI',
      body: 'Your full legal assessment has been generated.',
      targetType: 'user',
      userId: userId,
    }).catch(err => this.logger.error('Failed to send push notification', err));
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

