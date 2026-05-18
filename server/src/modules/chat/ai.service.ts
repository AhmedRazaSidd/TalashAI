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
  ): Promise<string> {
    try {
      client.emit('agent_stream', { trace: '🚀 Initializing Talash AI Pipeline...' });

      // 1. Call Python FastAPI
      const response = await this.httpService.axiosRef.post(
        'http://localhost:8000/analyze',
        {
          message: content,
          history: history,
        }
      );

      const result = response.data;

      // 2. As response comes back, emit socket events to frontend
      
      // Agent traces (simulated/extracted from response)
      client.emit('agent_stream', {
        trace: `✅ CaseClassifier — ${result.primary_category || category} ` + (result.readiness_score ? `${result.readiness_score}%` : '')
      });
      client.emit('agent_stream', { trace: '✅ ActionPlanner — Steps Generated' });
      client.emit('agent_stream', { trace: '✅ MisguideDetector — Risk Analyzed' });

      // Final cards in this exact order:

      // Card 1: Case Dashboard
      client.emit('agent_stream', {
        chunk: `\n\`\`\`json\n${JSON.stringify({
          type: "dashboard",
          score: result.readiness_score,
          case_type: result.primary_category,
          missing_docs: result.missing_docs_count,
          risk: result.fraud_risk,
          free_aid: result.free_aid_eligible
        })}\n\`\`\`\n`
      });

      // Card 2: Action Plan
      client.emit('agent_stream', {
        chunk: `\n\`\`\`json\n${JSON.stringify({
          type: "action_plan",
          steps: result.action_plan
        })}\n\`\`\`\n`
      });

      // Card 3: MisguideDetector
      if (result.red_flags && result.red_flags.length > 0) {
        client.emit('agent_stream', {
          chunk: `\n\`\`\`json\n${JSON.stringify({
            type: "misguide_alert",
            flags: result.red_flags
          })}\n\`\`\`\n`
        });
      }

      // Card 4: PDF Links
      if (result.pdf_files && result.pdf_files.length > 0) {
        // We'll iterate through files if there are multiple, or just pass the array if the frontend supports it.
        // Based on ChatScreen modifications, data.url and data.filename are expected, so we'll emit one for each or the first.
        const file = result.pdf_files[0];
        client.emit('agent_stream', {
          chunk: `\n\`\`\`json\n${JSON.stringify({
            type: "pdf_link",
            url: file.url || file,
            filename: file.filename || 'Action_Plan.pdf'
          })}\n\`\`\`\n`
        });
      }

      // 3. Return full response text for saving
      // Save a summarized string into the database instead of raw JSON
      return `Case Dashboard: ${result.readiness_score}% Readiness. ${result.primary_category}. \nAction Plan generated with ${result.action_plan?.length || 0} steps.`;

    } catch (err) {
      this.logger.error('Python AI API call failed:', err);
      client.emit('message_error', { error: 'Failed to process pipeline', sessionId });
      return 'Sorry, the AI pipeline encountered an error.';
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

