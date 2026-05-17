import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true, enum: ['all', 'user'] })
  targetType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ default: Date.now })
  sentAt: Date;

  @Prop({ default: 'sent', enum: ['sent', 'failed'] })
  status: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
