import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ChatSessionDocument = ChatSession & Document;

@Schema({ timestamps: true })
export class ChatSession {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: false, default: 'General' })
  category: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  lawyerId: MongooseSchema.Types.ObjectId;

  @Prop({ default: 'active', enum: ['active', 'waiting_for_lawyer', 'with_lawyer', 'resolved'] })
  status: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

ChatSessionSchema.index({ userId: 1, status: 1 });
ChatSessionSchema.index({ lawyerId: 1, status: 1 });
