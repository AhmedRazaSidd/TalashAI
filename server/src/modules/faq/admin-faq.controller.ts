import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('FAQ (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/faq')
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Get all FAQs (including inactive)' })
  async findAll() {
    const faqs = await this.faqService.findAll();
    return {
      success: true,
      message: 'FAQs retrieved successfully',
      data: faqs,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new FAQ' })
  async create(@Body() createFaqDto: CreateFaqDto) {
    const faq = await this.faqService.create(createFaqDto);
    return {
      success: true,
      message: 'FAQ created successfully',
      data: faq,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing FAQ' })
  async update(@Param('id') id: string, @Body() updateFaqDto: UpdateFaqDto) {
    const faq = await this.faqService.update(id, updateFaqDto);
    return {
      success: true,
      message: 'FAQ updated successfully',
      data: faq,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an FAQ' })
  async remove(@Param('id') id: string) {
    await this.faqService.remove(id);
    return {
      success: true,
      message: 'FAQ deleted successfully',
      data: {},
    };
  }
}
