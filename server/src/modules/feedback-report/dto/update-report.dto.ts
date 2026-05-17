import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ['pending', 'reviewed', 'resolved'], example: 'resolved' })
  @IsEnum(['pending', 'reviewed', 'resolved'])
  @IsNotEmpty()
  status: string;
}
