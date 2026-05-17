import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ai_system_prompt?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  max_messages_per_day?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  max_voice_per_day?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  maintenance_mode?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  force_update?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  min_app_version?: string;
}
