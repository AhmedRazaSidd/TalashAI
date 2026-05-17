import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { User, UserDocument, Review } from './schema/user.schema';
import { Category, CategoryDocument } from '../chat/schema/category.schema';
import { ChatSession, ChatSessionDocument } from '../chat/schema/chat-session.schema';
import { Message, MessageDocument } from '../chat/schema/message.schema';
import { Faq, FaqDocument } from '../faq/schema/faq.schema';
import { SubscriptionPlan, SubscriptionPlanDocument } from '../subscription-plan/schema/subscription-plan.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectConnection() private connection: Connection,
    @InjectModel('User') private userModel: Model<UserDocument>,
    @InjectModel('Category') private categoryModel: Model<CategoryDocument>,
    @InjectModel('Review') private reviewModel: Model<any>,
    @InjectModel('ChatSession') private sessionModel: Model<ChatSessionDocument>,
    @InjectModel('Message') private messageModel: Model<MessageDocument>,
    @InjectModel('Faq') private faqModel: Model<FaqDocument>,
    @InjectModel('SubscriptionPlan') private planModel: Model<SubscriptionPlanDocument>,
  ) { }

  async runSeed() {
    this.logger.log('Starting DB Seeding (Deep Scan Mode)...');

    try {
      this.logger.log('1. Clearing Database...');
      const collections = Object.keys(this.connection.collections);
      for (const collectionName of collections) {
        await this.connection.collections[collectionName].deleteMany({});
      }

      this.logger.log('2. Seeding Categories...');
      const categories = [
        { name: 'Property Law', icon: '🏠' },
        { name: 'Family & Marriage', icon: '👨‍👩‍👧' },
        { name: 'Criminal Defense', icon: '⚖️' },
        { name: 'Labor & Employment', icon: '💼' },
        { name: 'Financial & Tax', icon: '💰' },
        { name: 'Civil Litigation', icon: '📜' },
      ];
      try { await this.categoryModel.insertMany(categories); } catch (e) { this.logger.error('Failed to insert Categories'); throw e; }

      this.logger.log('3. Seeding Victim...');
      let victim;
      try {
        victim = await new this.userModel({
          name: 'Ahmed Ali',
          phone_number: '03001234567',
          password: 'user123',
          state: 'Punjab',
          city: 'Lahore',
          gender: 'male',
          role: 'user',
        }).save();
      } catch (e) { this.logger.error(`Failed to save Victim: ${e.message}`); throw e; }

      this.logger.log('4. Seeding Lawyer...');
      let lawyer;
      try {
        lawyer = await new this.userModel({
          name: 'Barrister Zafarullah',
          phone_number: '03112223334',
          password: 'lawyer123',
          state: 'Sindh',
          city: 'Karachi',
          gender: 'male',
          role: 'lawyer',
          isVerified: true,
          specializations: ['Criminal Defense'],
          lawyerDescription: 'Expert lawyer.',
          rating: 4.8,
          casesSolved: 120,
          experienceYears: 15,
        }).save();
      } catch (e) { this.logger.error(`Failed to save Lawyer: ${e.message}`); throw e; }

      this.logger.log('5. Seeding Subscription Plans...');
      const plans = [
        {
          name: 'AI Standard',
          price: 0,
          currency: 'PKR',
          durationInDays: 30,
          features: ['Daily AI Chat Limit: 10', 'Access to Marketplace', 'Text-only responses'],
          isActive: true
        },
        {
          name: 'AI Legal Premium',
          price: 299,
          currency: 'PKR',
          durationInDays: 30,
          features: ['Unlimited AI Legal Guidance', 'Full Audio/Voice Responses', 'Priority lawyer search matching', 'Advanced legal templates'],
          isActive: true
        },
        {
          name: 'Enterprise Counsel Pro',
          price: 999,
          currency: 'PKR',
          durationInDays: 30,
          features: ['Everything in Legal Premium', '2 Free Verified Lawyer consultations/mo', 'Dedicated document analysis OCR', 'Gold verified user badge'],
          isActive: true
        }
      ];
      try { await this.planModel.insertMany(plans); } catch (e) { this.logger.error('Failed to insert Plans'); throw e; }

      this.logger.log('6. Seeding FAQs...');
      const faqs = [
        { question: 'What is Talash AI?', answer: 'Talash AI is an advanced legal assistant specializing in Pakistani law. It helps users understand their legal rights and find the best lawyers for their cases.', order: 1 },
        { question: 'Is the AI advice legally binding?', answer: 'No, Talash AI provides legal guidance and information based on Pakistani statutes, but it is not a replacement for a human lawyer. We recommend consulting a verified lawyer for final decisions.', order: 2 },
        { question: 'How can I find a lawyer?', answer: 'Go to the Explore tab to browse verified lawyers, or ask Talash AI to recommend a specialist based on your chat history.', order: 3 },
        { question: 'Are my chats private?', answer: 'Yes, all your conversations with Talash AI are encrypted and private. We only share case details with a lawyer when you explicitly choose to hire one.', order: 4 },
      ];
      try { await this.faqModel.insertMany(faqs); } catch (e) { this.logger.error('Failed to insert FAQs'); throw e; }

      this.logger.log('Seeding Complete! 🎉');
      return { success: true, message: 'Seeded successfully' };
    } catch (error) {
      this.logger.error(`MASTER SEED FAILED: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

