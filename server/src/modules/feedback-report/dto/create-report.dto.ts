import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ example: '60d5ec49c1234567890abcdef' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ enum: ['message', 'user'], example: 'message' })
  @IsEnum(['message', 'user'])
  targetType: string;

  @ApiProperty({ example: 'Inappropriate content' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ example: 'User sent a bad word.' })
  @IsString()
  @IsOptional()
  description?: string;
}
