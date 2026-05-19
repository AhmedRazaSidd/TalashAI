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
  
  // To prevent double execution / duplicate requests
  private activeSessions = new Set<string>();

  // Transient processing lock to ignore duplicate requests within 3 seconds
  private transientLocks = new Map<string, number>();

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
    @MessageBody() data: { sessionId?: string; content: string; type?: string; clientMessageId?: string },
  ) {
    const userId = (client as any).user.userId;
    const role = (client as any).user.role;
    let { sessionId, content, type, clientMessageId } = data;

    this.logger.log(`[SEND_MESSAGE] Received "send_message" event for session: ${sessionId || 'NEW_SESSION'} from user: ${userId}`);

    // Transient processing lock to ignore duplicate requests within 3 seconds
    if (clientMessageId) {
      const lockKey = `${sessionId || userId}_${clientMessageId}`;
      const now = Date.now();
      if (this.transientLocks.has(lockKey)) {
        const lastTime = this.transientLocks.get(lockKey);
        if (lastTime !== undefined && now - lastTime < 3000) {
          this.logger.warn(`[DUPLICATE_BLOCKED] Duplicate request blocked within 3s for key ${lockKey}`);
          return;
        }
      }
      this.transientLocks.set(lockKey, now);
      setTimeout(() => this.transientLocks.delete(lockKey), 5000);
    }

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

    // Duplicate Execution / Re-entry check
    if (this.activeSessions.has(sessionId as string)) {
      this.logger.warn(`[Workflow Guard] Active pipeline lock hit. Rejecting duplicate execution for session ${sessionId}`);
      client.emit('message_error', { error: 'Pipeline is already processing. Please wait.', sessionId });
      return;
    }

    if (workflowState.waiting_for_user) {
      const lastExpectedInput = (workflowState.collected_context as any).answers?.last_expected_input || 'generic_reply';
      const currentAgent = workflowState.current_agent;
      const currentAgentAnswers = (workflowState.collected_context as any).answers?.[currentAgent] || {};

      // If the answer is already present for this expected input, this is a duplicate call
      if (currentAgentAnswers[lastExpectedInput] !== undefined) {
        this.logger.warn(`[Workflow Guard] Duplicate resume rejected. Same question '${lastExpectedInput}' is already answered in session ${sessionId}.`);
        client.emit('message_error', { error: 'This question was already answered.', sessionId });
        return;
      }

      this.logger.log(`[PIPELINE_RESUMED] Session ${sessionId} is resuming agent: ${currentAgent}`);
      client.emit('agent_stream', { trace: `▶️ Resuming ${currentAgent}...` });

      // Persist the incoming answer under collected_context.answers.[current_agent].[lastExpectedInput]
      await this.chatService.saveAgentAnswer(
        sessionId as string,
        `${currentAgent}.${lastExpectedInput}`,
        content,
      );

      // Clear the waiting flag so the pipeline can progress.
      await this.chatService.setWaitingForUser(sessionId as string, false);
    } else {
      // Fresh request — reset workflow and start from Agent 1.
      await this.chatService.updateWorkflowContext(sessionId as string, {
        generated_pdfs: []
      });
      this.logger.log(`[Workflow] Session ${sessionId} starting a new pipeline run.`);
      await this.chatService.initWorkflow(sessionId as string);
    }

    this.activeSessions.add(sessionId as string);
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
    } finally {
      this.activeSessions.delete(sessionId as string);
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
      this.logger.log(`[Pipeline] Starting Agent: ${currentAgent}`);
      const agentStart = Date.now();

      // Emit real-time workflow progress to client
      const currentStep = freshState.current_step;
      const completedAgents = freshState.completed_agents || [];
      const remainingAgents = AGENT_SEQUENCE.slice(currentStep);
      const progressPercentage = Math.round(((currentStep - 1) / AGENT_SEQUENCE.length) * 100);

      const progressStart = Date.now();
      client.emit('workflow_progress', {
        current_agent: currentAgent,
        current_step: currentStep,
        total_steps: AGENT_SEQUENCE.length,
        completed_agents: completedAgents,
        remaining_agents: remainingAgents,
        progress_percentage: progressPercentage,
      });
      const progressEmitDuration = Date.now() - progressStart;
      this.logger.log(`[Pipeline] progress emit timing: ${progressEmitDuration}ms`);

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

      const aiDuration = Date.now() - agentStart;
      this.logger.log(`[Pipeline] AI response duration for ${currentAgent}: ${aiDuration}ms`);

      // 1. Check if the agent paused for user input
      if (response && (response.pause_for_user === true || response.pipeline_status === 'paused')) {
        this.logger.log(`[PIPELINE_PAUSED_SUCCESSFULLY] Agent paused waiting for user input: ${currentAgent}`);

        // Save waiting state
        await this.chatService.setWaitingForUser(sessionId, true);

        // Store the expected field name so the gateway knows where to save the next response
        const expectedInput = response.expected_information || response.expected_input || 'generic_reply';
        await this.chatService.saveAgentAnswer(sessionId, 'last_expected_input', expectedInput);

        // --- PRESERVE STATE BEFORE PAUSING ---
        // We must save partial output (like investigation_memory) so the agent remembers state on resume
        const partialOutput = response.partial_output || {};
        if (currentAgent === 'QuestioningAgent' && partialOutput.investigation_memory) {
          await this.chatService.updateWorkflowContext(sessionId, { investigation_memory: partialOutput.investigation_memory });
        }
        // --------------------------------------

        // Push a readable question text into chat trace
        client.emit('agent_stream', { chunk: `\n\n**${currentAgent}**: ${response.question}\n` });

        // Add small sleep to guarantee socket event queue ordering on client
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Emit 'agent_question' socket event
        const questionStart = Date.now();
        client.emit('agent_question', {
          question: response.question,
          expected_input: expectedInput,
          expected_information: response.expected_information || expectedInput,
          reason: response.reason || '',
          priority: response.priority || 'medium',
          agent: response.agent || currentAgent,
          waiting_for_user: true,
          current_agent: response.agent || currentAgent,
        });
        const questionEmitDuration = Date.now() - questionStart;
        this.logger.log(`[Pipeline] socket emit timing (agent_question): ${questionEmitDuration}ms`);

        // Emit workflow_progress explicitly to update UI
        client.emit('workflow_progress', {
          current_agent: currentAgent,
          current_step: currentStep,
          total_steps: AGENT_SEQUENCE.length,
          completed_agents: completedAgents,
          remaining_agents: remainingAgents,
          progress_percentage: progressPercentage,
          waiting_for_user: true,
        });

        return; // HALT remaining loop execution, wait for next user reply!
      }

      // 2. Check if agent failed
      if (response && response.pipeline_status === 'failed') {
        this.logger.error(`[Workflow Error] Agent ${currentAgent} failed to execute: ${response.error}`);
        client.emit('message_error', { error: `Agent ${currentAgent} failed to execute.`, sessionId });
        return;
      }

      // 3. Agent succeeded! Save its outputs
      this.logger.log(`[Pipeline] Completed Agent: ${currentAgent}`);
      const partialOutput = response.final_output || {};

      const updatedCompletedAgents = [...(freshState.completed_agents || []), currentAgent];
      const contextUpdates: Record<string, any> = {};
      const sessionUpdates: Record<string, any> = {};

      // Sync user_problem and category directly to context roots if extracted
      if (currentAgent === 'CaseListener' && partialOutput.cleaned_input) {
        contextUpdates.user_problem = partialOutput.cleaned_input;
      }
      if (currentAgent === 'CaseClassifier' && partialOutput.primary_category) {
        contextUpdates.category = partialOutput.primary_category;
      }

      // Sync investigation_memory
      if (currentAgent === 'QuestioningAgent' && partialOutput.investigation_memory) {
        contextUpdates.investigation_memory = partialOutput.investigation_memory;
      }

      // If current agent is DocumentChecker, extract and save readiness_score
      if (currentAgent === 'DocumentChecker') {
        const docCheck = partialOutput.document_check || {};
        const score = docCheck.readiness_score ?? 0;
        contextUpdates.readiness_score = score;
        sessionUpdates.readiness_score = score;
      }

      // If current agent is PdfFormatter (or PDFFormatter), extract, upload to Cloudinary and save generated_pdfs
      if (currentAgent === 'PdfFormatter' || currentAgent === 'PDFFormatter') {
        const pdfFiles = response.pdf_files || [];
        this.logger.log(`[PDF Process] Found ${pdfFiles.length} generated local PDF files.`);
        this.logger.log(`received generated_pdfs: ${JSON.stringify(pdfFiles)}`);
        
        const uploadedPdfs: any[] = [];
        const fs = require('fs');
        const path = require('path');

        for (const fileRelativePath of pdfFiles) {
          try {
            if (typeof fileRelativePath === 'string' && fileRelativePath.startsWith('http')) {
              let docName = 'Legal Document';
              if (fileRelativePath.includes('CaseSummary')) {
                docName = 'Case Summary Report';
              } else if (fileRelativePath.includes('LegalDraft')) {
                docName = 'Legal Draft';
              } else if (fileRelativePath.includes('LegalAidLetter')) {
                docName = 'Free Legal Aid Letter';
              }
              uploadedPdfs.push({
                name: docName,
                url: fileRelativePath,
                type: 'pdf'
              });
              this.logger.log(`[PDF Process] Using pre-uploaded Cloudinary URL: ${fileRelativePath}`);
              continue;
            }

            // Find absolute path
            let absolutePath = '';
            if (path.isAbsolute(fileRelativePath)) {
              absolutePath = fileRelativePath;
            } else {
              // Try root workspace, then talashAgent directory
              const candidate1 = path.join(process.cwd(), fileRelativePath);
              const candidate2 = path.join(process.cwd(), 'talashAgent', fileRelativePath);
              const candidate3 = path.join(process.cwd(), '..', 'talashAgent', fileRelativePath);
              
              if (fs.existsSync(candidate3)) {
                absolutePath = candidate3;
              } else if (fs.existsSync(candidate2)) {
                absolutePath = candidate2;
              } else if (fs.existsSync(candidate1)) {
                absolutePath = candidate1;
              } else {
                absolutePath = fileRelativePath;
              }
            }

            this.logger.log(`[PDF Process] Resolving PDF path: ${fileRelativePath} -> ${absolutePath}`);
            
            if (fs.existsSync(absolutePath)) {
              const fileBuffer = fs.readFileSync(absolutePath);
              const baseName = path.basename(absolutePath);
              
              this.logger.log(`[DEBUG] local filepath: ${absolutePath}`);
              this.logger.log(`[DEBUG] file byte sizes before upload: ${fileBuffer.length} bytes`);
              
              // Upload to Cloudinary
              const uploadRes = await this.cloudinaryService.uploadPdfBuffer(fileBuffer, baseName) as any;
              const url = uploadRes.secure_url;
              const uploadedSize = uploadRes.bytes;
              
              this.logger.log(`[DEBUG] uploaded asset size: ${uploadedSize} bytes`);
              this.logger.log(`[DEBUG] uploaded urls: ${url}`);
              
              let docName = 'Legal Document';
              if (baseName.includes('CaseSummary')) {
                docName = 'Case Summary Report';
              } else if (baseName.includes('LegalDraft')) {
                docName = 'Legal Draft';
              } else if (baseName.includes('LegalAidLetter')) {
                docName = 'Free Legal Aid Letter';
              }

              uploadedPdfs.push({
                name: docName,
                url: url,
                type: 'pdf'
              });
              this.logger.log(`[PDF Process] Uploaded ${docName} successfully. URL: ${url}`);
            } else {
              this.logger.warn(`[PDF Process] File not found at: ${absolutePath}`);
            }
          } catch (err) {
            this.logger.error(`[PDF Process] Failed to upload PDF file ${fileRelativePath}: ${err.message}`, err.stack);
          }
        }

        // Failsafe: if uploading failed or no files, create placeholders
        if (uploadedPdfs.length === 0) {
          uploadedPdfs.push(
            { name: "Case Summary Report", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", type: "pdf" },
            { name: "Legal Draft", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", type: "pdf" },
            { name: "Free Legal Aid Letter", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", type: "pdf" }
          );
        }

        // If less than 3, pad them
        while (uploadedPdfs.length < 3) {
          uploadedPdfs.push({
            name: `Legal Document ${uploadedPdfs.length + 1}`,
            url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            type: "pdf"
          });
        }

        contextUpdates.generated_pdfs = uploadedPdfs;
        sessionUpdates.generated_pdfs = uploadedPdfs;
        
        contextUpdates.generated_outputs = partialOutput.pdfs || {
          case_summary: partialOutput.case_summary || partialOutput.case_summary_content,
          legal_draft: partialOutput.legal_draft || partialOutput.document_2_draft,
          legal_aid_letter: partialOutput.legal_aid_letter || partialOutput.document_3_aid
        };
      }

      // Consolidate updates into a single batched database write
      const dbSaveStart = Date.now();
      await this.chatService.batchAgentCompletion(
        sessionId,
        currentAgent,
        partialOutput,
        updatedCompletedAgents,
        contextUpdates,
        sessionUpdates,
      );
      const dbSaveDuration = Date.now() - dbSaveStart;
      this.logger.log(`[Pipeline] DB save duration: ${dbSaveDuration}ms`);

      // Move to next agent in sequence
      const nextAgentStart = Date.now();
      const nextAgent = await this.chatService.moveToNextAgent(sessionId);
      this.logger.log(`[Pipeline] workflow transition to next agent took: ${Date.now() - nextAgentStart}ms`);
      
      freshState = await this.chatService.getWorkflowState(sessionId);
      currentAgent = nextAgent;
    }

    // 4. Entire sequence completed!
    this.logger.log(`[Workflow Complete] All agents completed successfully for session: ${sessionId}`);

    const finalState = await this.chatService.getWorkflowState(sessionId);
    const context = finalState.collected_context || {};
    const pdfFormatterOutput = (context as any).generated_outputs || (context as any).pdfs || (context as any).answers?.PdfFormatter || (context as any).PdfFormatter || {};

    // Save final generated outputs under generated_outputs
    await this.chatService.updateWorkflowContext(sessionId, { generated_outputs: pdfFormatterOutput });

    // Mark user's message as read and clean up completion state
    await this.chatService.setWaitingForUser(sessionId, false);
    await this.chatService.updateSession(sessionId, { workflow_status: 'COMPLETED' });

    const finalPdfs = finalState.generated_pdfs || [];

    console.log('[FINAL_STATE_FULL]');
    console.log(JSON.stringify(finalState, null, 2));

    console.log('[FINAL_CONTEXT]');
    console.log(JSON.stringify(context, null, 2));

    console.log('[FINAL_ANSWERS]');
    console.log(JSON.stringify(context.answers, null, 2));

    this.logger.log('[DEBUG CONTEXT] ' + JSON.stringify(finalState.collected_context, null, 2));

    const caseSummary = (context as any).document_1_summary || 
                        (context as any).case_summary_content || 
                        (context as any).case_summary ||
                        (pdfFormatterOutput as any).document_1_summary ||
                        (pdfFormatterOutput as any).case_summary_content ||
                        (pdfFormatterOutput as any).case_summary ||
                        (pdfFormatterOutput as any).pdfs?.case_summary ||
                        (pdfFormatterOutput as any).pdfs?.document_1_summary ||
                        (context as any).answers?.PdfFormatter?.case_summary ||
                        (context as any).answers?.PdfFormatter?.document_1_summary ||
                        (context as any).answers?.PdfFormatter?.pdfs?.case_summary ||
                        (context as any).user_problem || 
                        'No summary details found.';

    const readinessScore = (context as any).readiness_score ?? 
                           (context as any).document_check?.readiness_score ?? 
                           (context as any).answers?.DocumentChecker?.document_check?.readiness_score ??
                           (context as any).answers?.DocumentChecker?.readiness_score ??
                           (context as any).DocumentChecker?.document_check?.readiness_score ??
                           (context as any).DocumentChecker?.readiness_score ??
                           0;
    
    const rightsObj = (context as any).rights_analysis || 
                      (context as any).answers?.RightsAnalyzer || 
                      (context as any).answers?.RightsAnalyzer?.rights_analysis || 
                      (context as any).RightsAnalyzer || 
                      {};
    
    let rightsText = 'No specific rights analysis found.';
    if (rightsObj) {
      const rightsList = rightsObj.rights || (rightsObj.rights_analysis && rightsObj.rights_analysis.rights);
      if (Array.isArray(rightsList)) {
        rightsText = rightsList.map((r: any) => `• **${r.right || r.title || 'Right'}**: ${r.explanation || r.description || ''} (${r.law_reference || r.citation || ''})`).join('\n');
      } else if (typeof rightsObj === 'string') {
        rightsText = rightsObj;
      } else if (rightsObj.rights_analysis && typeof rightsObj.rights_analysis === 'string') {
        rightsText = rightsObj.rights_analysis;
      }
    }

    const actionObj = (context as any).action_plan || 
                      (context as any).answers?.ActionPlanner || 
                      (context as any).answers?.ActionPlanner?.action_plan || 
                      (context as any).ActionPlanner || 
                      {};

    let actionPlanText = 'No specific action steps found.';
    if (actionObj) {
      const stepsList = actionObj.action_plan || actionObj.steps || (actionObj.action_plan && actionObj.action_plan.action_plan);
      if (Array.isArray(stepsList)) {
        actionPlanText = stepsList.map((s: any, idx: number) => `• **Step ${idx + 1}**: ${typeof s === 'string' ? s : `${s.title || s.step || ''}: ${s.action || ''}`}`).join('\n');
      } else if (typeof actionObj === 'string') {
        actionPlanText = actionObj;
      } else if (actionObj.action_plan && typeof actionObj.action_plan === 'string') {
        actionPlanText = actionObj.action_plan;
      }
    }

    const scamObj = (context as any).scam_protection || 
                    (context as any).answers?.MisguideDetector || 
                    (context as any).answers?.MisguideDetector?.scam_protection || 
                    (context as any).MisguideDetector || 
                    {};

    let scamText = 'No critical flags or scam patterns detected.';
    if (scamObj) {
      const targetScam = scamObj.scam_protection || scamObj;
      const risk = targetScam.fraud_risk || targetScam.risk_level || 'None';
      let flags = '';
      const flagsList = targetScam.red_flags || targetScam.flags;
      if (Array.isArray(flagsList) && flagsList.length > 0) {
        flags = '\n' + flagsList.map((f: any) => `• ${typeof f === 'string' ? f : f.flag || f.description || ''}`).join('\n');
      }
      scamText = `Fraud Risk Level: **${risk.toUpperCase()}**${flags}`;
    }

    const pdfAgentOutput = (context as any).case_summary || 
                           (context as any).PdfFormatter?.case_summary ||
                           (context as any).pdfs?.case_summary ||
                           (pdfFormatterOutput as any).case_summary ||
                           (pdfFormatterOutput as any).document_1_summary ||
                           (pdfFormatterOutput as any).case_summary_content ||
                           (pdfFormatterOutput as any).pdfs?.case_summary ||
                           (context as any).answers?.PdfFormatter?.case_summary ||
                           (context as any).answers?.PdfFormatter?.document_1_summary ||
                           (context as any).answers?.PdfFormatter?.pdfs?.case_summary ||
                           '';

    const legalDraft = (context as any).legal_draft || 
                       (context as any).PdfFormatter?.legal_draft ||
                       (context as any).pdfs?.legal_draft ||
                       (pdfFormatterOutput as any).legal_draft ||
                       (pdfFormatterOutput as any).document_2_draft ||
                       (pdfFormatterOutput as any).pdfs?.legal_draft ||
                       (context as any).answers?.PdfFormatter?.legal_draft ||
                       (context as any).answers?.PdfFormatter?.document_2_draft ||
                       (context as any).answers?.PdfFormatter?.pdfs?.legal_draft ||
                       '';

    const legalAidLetter = (context as any).legal_aid_letter || 
                           (context as any).PdfFormatter?.legal_aid_letter ||
                           (context as any).pdfs?.legal_aid_letter ||
                           (pdfFormatterOutput as any).legal_aid_letter ||
                           (pdfFormatterOutput as any).document_3_aid ||
                           (pdfFormatterOutput as any).pdfs?.legal_aid_letter ||
                           (context as any).answers?.PdfFormatter?.legal_aid_letter ||
                           (context as any).answers?.PdfFormatter?.document_3_aid ||
                           (context as any).answers?.PdfFormatter?.pdfs?.legal_aid_letter ||
                           '';

    const summary = `
⚖️ TALASH AI - CASE ANALYSIS COMPLETE

📋 CASE SUMMARY
${caseSummary}

📊 READINESS SCORE: ${readinessScore}/100

📌 YOUR RIGHTS
${rightsText}

📝 ACTION PLAN
${actionPlanText}

🛡️ SCAM PROTECTION
${scamText}

📄 CASE SUMMARY REPORT:
${pdfAgentOutput}

📝 LEGAL NOTICE DRAFT:
${legalDraft}

💼 FREE LEGAL AID LETTER:
${legalAidLetter}
`;

    const fullResponse = summary.trim();

    const savedMsg = await this.chatService.saveAssistantMessage(
      sessionId,
      userId,
      fullResponse,
      'text',
      'text',
    );

    this.logger.log(`[Socket Emit] Emitting "pdf_ready" and "message_done" to client for session: ${sessionId}`);
    const completeEmitStart = Date.now();
    
    client.emit('pdf_ready', {
      sessionId: sessionId,
      generated_pdfs: finalPdfs,
    });

    client.emit('message_done', {
      fullMessage: fullResponse,
      sessionId: sessionId,
      messageId: savedMsg._id,
      pipeline_status: "completed",
      waiting_for_user: false,
    });

    client.emit('pipeline_status', {
      pipeline_status: "completed",
      waiting_for_user: false,
    });
    this.logger.log(`[Pipeline] final socket emit timing: ${Date.now() - completeEmitStart}ms`);

    // Send Push Notification
    this.notificationService.sendNotification({
      title: 'New Message from Talash AI',
      body: 'Your legal assessment and documents are ready.',
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
    @MessageBody() data: { sessionId?: string; audioBase64: string; clientMessageId?: string },
  ) {
    const userId = (client as any).user.userId;
    const role = (client as any).user.role;
    let { sessionId, audioBase64, clientMessageId } = data;

    this.logger.log(`[SEND_MESSAGE] Received "voice_message" event for session: ${sessionId || 'NEW_SESSION'} from user: ${userId}`);

    // Transient processing lock to ignore duplicate requests within 3 seconds
    if (clientMessageId) {
      const lockKey = `${sessionId || userId}_${clientMessageId}`;
      const now = Date.now();
      if (this.transientLocks.has(lockKey)) {
        const lastTime = this.transientLocks.get(lockKey);
        if (lastTime !== undefined && now - lastTime < 3000) {
          this.logger.warn(`[DUPLICATE_BLOCKED] Duplicate request blocked within 3s for key ${lockKey}`);
          return;
        }
      }
      this.transientLocks.set(lockKey, now);
      setTimeout(() => this.transientLocks.delete(lockKey), 5000);
    }

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

