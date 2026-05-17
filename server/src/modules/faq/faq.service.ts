import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Faq, FaqDocument } from './schema/faq.schema';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqService {
  constructor(@InjectModel(Faq.name) private faqModel: Model<FaqDocument>) {}

  async findAllActive() {
    return this.faqModel.find({ isActive: true }).sort({ order: 1 }).exec();
  }

  async findAll() {
    return this.faqModel.find().sort({ order: 1 }).exec();
  }

  async create(createFaqDto: CreateFaqDto) {
    const newFaq = new this.faqModel(createFaqDto);
    return newFaq.save();
  }

  async update(id: string, updateFaqDto: UpdateFaqDto) {
    const updatedFaq = await this.faqModel
      .findByIdAndUpdate(id, updateFaqDto, { returnDocument: 'after' })
      .exec();
    if (!updatedFaq) {
      throw new NotFoundException('FAQ not found');
    }
    return updatedFaq;
  }

  async remove(id: string) {
    const deletedFaq = await this.faqModel.findByIdAndDelete(id).exec();
    if (!deletedFaq) {
      throw new NotFoundException('FAQ not found');
    }
    return deletedFaq;
  }
}
