import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['text', 'audio'] })
  @IsString()
  @IsOptional()
  @IsIn(['text', 'audio'])
  voiceResponseMode?: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}
