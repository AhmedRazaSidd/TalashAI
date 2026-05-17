import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reporterId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  targetId: string; // Could be a userId or a messageId

  @Prop({ required: true, enum: ['message', 'user'] })
  targetType: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'pending', enum: ['pending', 'reviewed', 'resolved'] })
  status: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
