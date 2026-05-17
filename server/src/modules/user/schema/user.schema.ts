import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  phone_number: string;

  @Prop({ required: true })
  password?: string; // Optional because we might omit it in responses

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  gender: string;

  @Prop({ default: 'user', enum: ['user', 'admin', 'lawyer'] })
  role: string;

  @Prop({ default: null })
  avatar: string;

  @Prop({ default: null })
  refreshToken: string;

  @Prop({ default: null })
  fcmToken: string;

  @Prop({ default: 'text', enum: ['text', 'audio'] })
  voiceResponseMode: string;

  @Prop({ default: true })
  isActive: boolean;

  // Lawyer specific fields
  @Prop({ required: false })
  licenseId: string;

  @Prop({ type: [String], default: [] })
  specializations: string[];

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ required: false })
  lawyerDescription: string;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  casesSolved: number;

  @Prop({ default: 0 })
  experienceYears: number;

  // Subscription Fields
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SubscriptionPlan', default: null })
  subscriptionPlanId: MongooseSchema.Types.ObjectId;

  @Prop({ default: null })
  subscriptionExpiresAt: Date;

  @Prop({ default: 'none', enum: ['none', 'active', 'expired'] })
  subscriptionStatus: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1, isVerified: 1, rating: -1 });

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  lawyerId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  comment: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
