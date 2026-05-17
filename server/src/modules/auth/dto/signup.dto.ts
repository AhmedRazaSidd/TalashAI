import { IsString, IsNotEmpty, IsEnum, MinLength, IsPhoneNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, enum: ['user', 'lawyer'] })
  @IsOptional()
  @IsEnum(['user', 'lawyer'])
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  licenseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ each: true })
  specializations?: string[];
}
