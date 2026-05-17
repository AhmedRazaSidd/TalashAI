import { Controller, Get, Param, Query, UseGuards, Post, Body, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserService } from './user.service';

@ApiTags('Lawyers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lawyers')
export class LawyersController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List all verified lawyers with filters' })
  async listLawyers(
    @Query('sort') sort: string, // 'rating', 'experience', 'cases'
    @Query('specialization') specialization: string,
    @Query('search') search: string,
  ) {
    const lawyers = await this.userService.findLawyers(sort, specialization, search);
    return { success: true, data: lawyers };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lawyer profile with reviews' })
  async getLawyerProfile(@Param('id') id: string) {
    const profile = await this.userService.getLawyerProfile(id);
    return { success: true, data: profile };
  }

  @Post(':id/reviews')
  @ApiOperation({ summary: 'Add a review for a lawyer' })
  async addReview(
    @Request() req,
    @Param('id') lawyerId: string,
    @Body() body: { rating: number; comment: string }
  ) {
    const review = await this.userService.addReview(req.user.userId, lawyerId, body.rating, body.comment);
    return { success: true, data: review };
  }
}
