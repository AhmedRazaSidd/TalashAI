import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Socket } from 'socket.io';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private appConfigService: AppConfigService,
  ) {}

  async streamTextResponse(
    sessionId: string,
    content: string,
    client: Socket,
    history: any[] = [],
    category: string = 'General',
    attachments: string[] = [],
    userId?: string,
    collectedContext: Record<string, any> = {},
    targetAgent: string | null = null,
  ): Promise<any> {
    try {
      client.emit('agent_stream', { trace: `🚀 Executing agent ${targetAgent || 'Pipeline'}...` });

      const apiUrl = this.configService.get<string>('PYTHON_AI_API_URL') || 'http://localhost:8000';
      const apiKey = this.configService.get<string>('PYTHON_AI_API_KEY');

      this.logger.log(`[FastAPI Hit] Sending request to Python Agent at: ${apiUrl}/analyze`);

      return await new Promise<any>((resolve, reject) => {
        this.httpService.axiosRef.post(
          `${apiUrl}/analyze`,
          {
            user_input: content,
            input_type: 'text',
            category_hint: category,
            collected_context: collectedContext,
            target_agent: targetAgent,
          },
          {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            responseType: 'stream',
          }
        ).then((response) => {
          this.logger.log('[AI Response] Successfully connected to Python Agent stream');
          const stream = response.data;
          let currentEvent = '';
          let finalDataStr = '';
          let buffer = '';

          stream.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.substring(0, newlineIdx).trim();
              buffer = buffer.substring(newlineIdx + 1);
              
              if (line.startsWith('event: ')) {
                currentEvent = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.substring(6).trim();
                // Because JSON.stringify has no newlines, dataStr won't be truncated. 
                // However, if SSE breaks a large JSON across multiple 'data: ' lines, we append it.
                if (currentEvent === 'status') {
                  this.logger.log(`[Agent Stream] Status: ${dataStr}`);
                  client.emit('agent_stream', { trace: dataStr });
                } else if (currentEvent === 'final') {
                  finalDataStr += dataStr;
                }
              }
            }
          });

          stream.on('end', () => {
            this.logger.log(`[Agent Stream] Stream ended. Final payload length: ${finalDataStr.length}`);
            
            if (finalDataStr) {
              let finalData: any = {};
              try {
                finalData = JSON.parse(finalDataStr);
                this.logger.log(`[Agent Stream] Successfully parsed final payload.`);
              } catch (e) {
                this.logger.error('Failed to parse final data JSON', e);
              }

              // Only emit final cards when PdfFormatter completes
              if (finalData.agent === 'PdfFormatter' && finalData.pipeline_status === 'agent_complete') {
                const ctx = finalData.final_output || {};

                const readiness_score = ctx.document_check?.readiness_score ?? 0;
                const primary_category = ctx.primary_category ?? category;
                const missing_docs_count = ctx.document_check?.documents_missing?.length ?? 0;
                const fraud_risk = ctx.scam_protection?.fraud_risk ?? 'none';
                const free_aid_eligible = ctx.action_plan?.free_legal_aid_available ?? false;
                const action_plan_steps = ctx.action_plan?.action_plan ?? [];
                const rights_summary = ctx.rights_analysis?.rights ?? [];
                const red_flags = ctx.scam_protection?.red_flags ?? [];
                const pdf_files = finalData.pdf_files ?? [];

                // Card 1: Case Dashboard
                client.emit('agent_stream', {
                  chunk: `\n\`\`\`json\n${JSON.stringify({
                    type: "dashboard",
                    score: readiness_score,
                    case_type: primary_category,
                    missing_docs: missing_docs_count,
                    risk: fraud_risk,
                    free_aid: free_aid_eligible,
                    rights_summary: rights_summary
                  })}\n\`\`\`\n`
                });

                // Card 2: Action Plan
                client.emit('agent_stream', {
                  chunk: `\n\`\`\`json\n${JSON.stringify({
                    type: "action_plan",
                    steps: action_plan_steps.map((s: any) => typeof s === 'string' ? s : `${s.title}: ${s.action}`)
                  })}\n\`\`\`\n`
                });

                // Card 3: MisguideDetector
                if (red_flags.length > 0) {
                  client.emit('agent_stream', {
                    chunk: `\n\`\`\`json\n${JSON.stringify({
                      type: "misguide_alert",
                      flags: red_flags.map((f: any) => typeof f === 'string' ? f : f.flag)
                    })}\n\`\`\`\n`
                  });
                }

                // Card 4: PDF Links
                if (pdf_files.length > 0) {
                  const file = pdf_files[0];
                  client.emit('agent_stream', {
                    chunk: `\n\`\`\`json\n${JSON.stringify({
                      type: "pdf_link",
                      url: file.url || file,
                      filename: file.filename || 'Action_Plan.pdf'
                    })}\n\`\`\`\n`
                  });
                }
              }

              resolve(finalData);
            } else {
              resolve({ pipeline_status: 'failed', error: 'No final data received' });
            }
          });

          stream.on('error', (err: any) => {
            this.logger.error('Stream error:', err);
            client.emit('message_error', { error: 'Pipeline stream interrupted', sessionId });
            resolve({ pipeline_status: 'failed', error: 'Stream error' });
          });
        }).catch(err => {
          this.logger.error('Python AI API call failed:', err);
          client.emit('message_error', { error: 'Failed to process pipeline', sessionId });
          resolve({ pipeline_status: 'failed', error: 'HTTP call failed' });
        });
      });

    } catch (err) {
      this.logger.error('Outer wrapper error:', err);
      client.emit('message_error', { error: 'Failed to initialize pipeline', sessionId });
      return { pipeline_status: 'failed', error: 'Initialization error' };
    }
  }

  async processAudioMessage(
    sessionId: string,
    audioUrl: string,
    responseMode: string,
    client: Socket,
    history: any[] = [],
    category: string = 'General',
    attachments: string[] = [],
    userId?: string,
  ): Promise<{ text: string; audioUrl: string | null }> {
    const apiUrl = this.configService.get<string>('PYTHON_AI_API_URL');
    const apiKey = this.configService.get<string>('PYTHON_AI_API_KEY');

    if (!apiUrl) {
      this.logger.error('PYTHON_AI_API_URL is not configured');
      const fallbackMsg = "Audio received. API not configured.";
      client.emit('message_chunk', { chunk: fallbackMsg, sessionId });
      return { text: fallbackMsg, audioUrl: null };
    }

    const configs = await this.appConfigService.getPublicConfig();
    const baseSystemPrompt = configs['ai_system_prompt'] || 'You are Talash AI, a high-performance legal assistant specialized in the Laws of Pakistan.';
    
    const systemPrompt = `
      ${baseSystemPrompt}
      
      CORE KNOWLEDGE:
      - You are an expert in Pakistani Law, including the Pakistan Penal Code (PPC), Civil Procedure Code (CPC), Family Laws, and Property Laws (Transfer of Property Act).
      - You must provide guidance based on Pakistani legal precedents and statutes.
      
      DOCUMENT ANALYSIS MODE:
      - If attachments are provided, you MUST inform the user that you have scanned their legal documents.
      - Analyze the provided documents (images/PDFs) for relevant legal details like names, dates, and clauses.
      - Explain the legal implications of these documents according to Pakistani law.
      
      CONTEXT:
      - Current Case Category: ${category}
      - Attached Documents: ${attachments.join(', ')}
      
      Stay professional, empathetic, and always remind the user that while you are an AI expert, they should eventually consult a registered lawyer (available in our Marketplace).
    `;

    return new Promise((resolve, reject) => {
      this.httpService.axiosRef
        .post(
          `${apiUrl}/voice`, // Assuming there is a /voice endpoint for audio processing
          {
            audioUrl,
            history,
            system_prompt: systemPrompt,
            attachments,
            responseMode, // 'text' or 'audio'
            stream: true,
            session_id: sessionId,
            user_id: userId,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
          },
        )
        .then((response) => {
          const stream = response.data;
          this.handleStream(stream, client, sessionId, (fullMessage, returnedAudioUrl) => {
            resolve({ text: fullMessage, audioUrl: returnedAudioUrl });
          }, reject);
        })
        .catch((err) => {
          this.logger.error('Audio API call failed:', err);
          client.emit('message_error', { error: 'Failed to process voice', sessionId });
          resolve({ text: 'Error processing audio.', audioUrl: null });
        });
    });
  }

  private handleStream(stream: any, client: Socket, sessionId: string, onDone: (msg: string, audioUrl: string|null) => void, onError: (err: any) => void) {
    let fullMessage = '';
    let ttsAudioUrl = null;

    stream.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter((line) => line.trim() !== '');
      for (const line of lines) {
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
          onDone(fullMessage, ttsAudioUrl);
          return;
        }
        try {
          const parsed = JSON.parse(message);
          
          if (parsed.chunk) {
            fullMessage += parsed.chunk;
            client.emit('message_chunk', { chunk: parsed.chunk, sessionId });
          }
          
          // If the AI returns a TTS audio URL, we capture it and emit it.
          if (parsed.audioUrl) {
             ttsAudioUrl = parsed.audioUrl;
             client.emit('voice_response', { audioUrl: ttsAudioUrl, sessionId });
          }
          
          // Optional: AI might return STT transcript chunk of user's voice
          if (parsed.transcriptChunk) {
             client.emit('transcript_chunk', { text: parsed.transcriptChunk, sessionId });
          }

        } catch (e) {
          // Ignore parsing errors for incomplete chunks
        }
      }
    });

    stream.on('end', () => {
      onDone(fullMessage, ttsAudioUrl);
    });

    stream.on('error', (err) => {
      this.logger.error('Stream error:', err);
      client.emit('message_error', { error: 'Stream interrupted', sessionId });
      onError(err);
    });
  }

  // --- NEW ADVANCED AI FEATURES ---

  async classifyCase(description: string): Promise<string> {
    const apiUrl = this.configService.get<string>('PYTHON_AI_API_URL');
    const apiKey = this.configService.get<string>('PYTHON_AI_API_KEY');

    try {
      const response = await this.httpService.axiosRef.post(`${apiUrl}/classify`, {
        text: description
      }, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return response.data.category || 'General';
    } catch (err) {
      this.logger.error('Classification failed:', err);
      return 'General';
    }
  }

  async analyzeDocument(fileUrl: string, sessionId?: string, userId?: string, fileName?: string): Promise<string> {
    const apiUrl = this.configService.get<string>('PYTHON_AI_API_URL');
    const apiKey = this.configService.get<string>('PYTHON_AI_API_KEY');

    try {
      const response = await this.httpService.axiosRef.post(`${apiUrl}/analyze_document`, {
        file_url: fileUrl,
        session_id: sessionId,
        user_id: userId,
        file_name: fileName,
      }, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return response.data.analysis || 'Could not analyze document.';
    } catch (err) {
      this.logger.error('Document OCR analysis failed:', err);
      return 'Error analyzing document.';
    }
  }

  async summarizeSession(history: any[]): Promise<string> {
    const apiUrl = this.configService.get<string>('PYTHON_AI_API_URL');
    const apiKey = this.configService.get<string>('PYTHON_AI_API_KEY');

    try {
      const response = await this.httpService.axiosRef.post(`${apiUrl}/summarize`, {
        messages: history
      }, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return response.data.summary || 'Summary unavailable.';
    } catch (err) {
      this.logger.error('Summarization failed:', err);
      return 'Could not generate summary.';
    }
  }
}

