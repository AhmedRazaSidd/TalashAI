import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChatSession', required: true })
  sessionId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant', 'lawyer'] })
  role: string;

  @Prop({ required: true, enum: ['text', 'audio', 'attachment', 'voice'] })
  type: string;

  @Prop({ default: null })
  content: string;

  @Prop({ default: null })
  fileUrl: string;

  @Prop({ default: null })
  audioUrl: string;

  @Prop({ default: null })
  transcript: string;

  @Prop({ default: 'text', enum: ['text', 'audio'] })
  responseMode: string;

  @Prop({ default: false })
  isBookmarked: boolean;

  @Prop({ default: 'sent', enum: ['sent', 'delivered', 'read'] })
  status: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
