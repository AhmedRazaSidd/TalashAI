import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../chat/dto/pagination.dto';

export class AdminFilterUserDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by exact or partial phone number' })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Filter by exact or partial name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'], description: 'Filter by user role' })
  @IsEnum(['user', 'admin'])
  @IsOptional()
  role?: string;
}
