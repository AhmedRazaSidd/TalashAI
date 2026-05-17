import { Controller, Get } from '@nestjs/common';
import { FaqService } from './faq.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('FAQ (Public)')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active FAQs' })
  async findAll() {
    const faqs = await this.faqService.findAllActive();
    return {
      success: true,
      message: 'FAQs retrieved successfully',
      data: faqs,
    };
  }
}
