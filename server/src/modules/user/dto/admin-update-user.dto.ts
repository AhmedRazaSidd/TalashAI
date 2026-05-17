import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'], example: 'admin' })
  @IsEnum(['user', 'admin'])
  @IsOptional()
  role?: string;

  // Additional fields like 'isBanned' could be added here later
}
