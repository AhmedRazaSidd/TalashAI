import { IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookmarkDto {
  @ApiProperty({ description: 'The ID of the message to bookmark', example: '60d5ec49c1234567890abcdef' })
  @IsMongoId()
  @IsNotEmpty()
  messageId: string;
}
