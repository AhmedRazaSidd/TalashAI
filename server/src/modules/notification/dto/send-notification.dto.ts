import { IsString, IsNotEmpty, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ example: 'New Feature Available!' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Check out the new voice chat mode.' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ enum: ['all', 'user'], example: 'all' })
  @IsEnum(['all', 'user'])
  targetType: string;

  @ApiPropertyOptional({ description: 'Required if targetType is user' })
  @IsMongoId()
  @IsOptional()
  userId?: string;
}
