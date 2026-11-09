import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORT_CATEGORY_SLUGS } from '../../../common/constants/support-categories.js';

export class RetrieveKnowledgeDto {
  @ApiProperty({ example: 'How do I register as a donor?' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  query!: string;

  @ApiPropertyOptional({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category?: string;
}

export class SubmitKnowledgeDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category!: string;

  @ApiProperty({ description: 'Plain text or markdown body' })
  @IsString()
  @MinLength(20)
  @MaxLength(100_000)
  content!: string;

  @ApiPropertyOptional({ example: 'donor-registration.md' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  filename?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;
}
