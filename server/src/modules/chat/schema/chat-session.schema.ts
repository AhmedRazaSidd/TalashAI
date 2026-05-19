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
  investigation_memory?: {
    already_asked_questions: string[];
    answered_topics: Record<string, any>;
    missing_information: string[];
    confidence_score: number;
  };
  completed_agents?: string[];
  readiness_score?: number;
  generated_pdfs?: string[];
  rights_analysis?: any;
  action_plan?: any;
  scam_protection?: any;
}

@Schema({ timestamps: true, minimize: false })
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

  @Prop({ default: 'ACTIVE' })
  workflow_status: string;

  @Prop({ default: null })
  current_agent: string;

  @Prop({ default: 0 })
  current_step: number;

  @Prop({ default: false })
  waiting_for_user: boolean;

  @Prop({ type: [String], default: [] })
  completed_agents: string[];

  @Prop({ type: Number, default: 0 })
  readiness_score: number;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  generated_pdfs: any[];

  @Prop({
    type: {
      user_problem: { type: String, default: null },
      category: { type: String, default: null },
      answers: { type: MongooseSchema.Types.Mixed, default: {} },
      documents: { type: [MongooseSchema.Types.Mixed], default: [] },
      risk_flags: { type: [String], default: [] },
      generated_outputs: { type: MongooseSchema.Types.Mixed, default: null },
      investigation_memory: {
        type: {
          already_asked_questions: { type: [String], default: [] },
          answered_topics: { type: MongooseSchema.Types.Mixed, default: {} },
          missing_information: { type: [String], default: [] },
          confidence_score: { type: Number, default: 0 }
        },
        default: () => ({
          already_asked_questions: [],
          answered_topics: {},
          missing_information: [],
          confidence_score: 0
        })
      },
      completed_agents: { type: [String], default: [] },
      readiness_score: { type: Number, default: 0 },
      generated_pdfs: { type: [MongooseSchema.Types.Mixed], default: [] },
      rights_analysis: { type: MongooseSchema.Types.Mixed, default: {} },
      action_plan: { type: MongooseSchema.Types.Mixed, default: {} },
      scam_protection: { type: MongooseSchema.Types.Mixed, default: {} }
    },
    default: () => ({
      user_problem: null,
      category: null,
      answers: {},
      documents: [],
      risk_flags: [],
      generated_outputs: null,
      investigation_memory: {
        already_asked_questions: [],
        answered_topics: {},
        missing_information: [],
        confidence_score: 0
      },
      completed_agents: [],
      readiness_score: 0,
      generated_pdfs: [],
      rights_analysis: {},
      action_plan: {},
      scam_protection: {}
    }),
  })
  collected_context: WorkflowContext;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.set('minimize', false);

ChatSessionSchema.index({ userId: 1, status: 1 });
ChatSessionSchema.index({ lawyerId: 1, status: 1 });
