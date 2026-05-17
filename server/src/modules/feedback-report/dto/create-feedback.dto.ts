import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ enum: ['bug', 'feature', 'other'], example: 'bug' })
  @IsEnum(['bug', 'feature', 'other'])
  type: string;

  @ApiProperty({ example: 'The app crashes when I open the chat.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ type: [String], example: ['https://cloudinary.com/image.png'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}
