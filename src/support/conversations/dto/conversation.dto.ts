import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORT_CATEGORY_SLUGS } from '../../../common/constants/support-categories.js';

export class CreateConversationDto {
  @ApiPropertyOptional({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: "I can't login." })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
