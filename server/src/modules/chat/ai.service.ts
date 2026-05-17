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
    const apiUrl = this.configService.get<string>('PYTHON_AI_API_URL');
    const apiKey = this.configService.get<string>('PYTHON_AI_API_KEY');

    if (!apiUrl) {
      this.logger.error('PYTHON_AI_API_URL is not configured');
      const fallbackMsg = "I am a fallback response because the AI API is not configured.";
      client.emit('message_chunk', { chunk: fallbackMsg, sessionId });
      return fallbackMsg;
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
      let fullMessage = '';

      this.httpService.axiosRef
        .post(
          apiUrl,
          {
            prompt: content,
            history: history,
            system_prompt: systemPrompt,
            attachments: attachments,
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
          this.handleStream(stream, client, sessionId, (msg, audioUrl) => {
             resolve(msg);
          }, reject);
        })
        .catch((err) => {
          this.logger.error('API call failed:', err);
          client.emit('message_error', { error: 'Failed to connect to AI', sessionId });
          resolve('Sorry, I encountered an error.');
        });
    });
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

