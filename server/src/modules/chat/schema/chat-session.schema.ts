import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ChatSessionDocument = ChatSession & Document;

export interface WorkflowContext {
  user_problem?: string;
  category?: string;
  answers?: Record<string, any>;
  documents?: any[];
  risk_flags?: string[];
  generated_outputs?: any;
}

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

  @Prop({ default: null })
  current_agent: string;

  @Prop({ default: 0 })
  current_step: number;

  @Prop({ default: false })
  waiting_for_user: boolean;

  @Prop({
    type: {
      user_problem: { type: String, default: null },
      category: { type: String, default: null },
      answers: { type: MongooseSchema.Types.Mixed, default: {} },
      documents: { type: [MongooseSchema.Types.Mixed], default: [] },
      risk_flags: { type: [String], default: [] },
      generated_outputs: { type: MongooseSchema.Types.Mixed, default: null },
    },
    default: () => ({
      user_problem: null,
      category: null,
      answers: {},
      documents: [],
      risk_flags: [],
      generated_outputs: null,
    }),
  })
  collected_context: WorkflowContext;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

ChatSessionSchema.index({ userId: 1, status: 1 });
ChatSessionSchema.index({ lawyerId: 1, status: 1 });
