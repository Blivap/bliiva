import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SUPPORT_CATEGORY_SLUGS } from '../../../common/constants/support-categories.js';
import { KnowledgeStatus } from '../../../common/enums/index.js';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export class KnowledgeFieldsDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category!: string;

  @ApiProperty({ example: 'ACCOUNT_LOGIN' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  intent!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  questions!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  phrases?: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  keywords!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  synonyms?: string[];

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  answer!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAuthentication?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresHumanSupport?: boolean;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;
}

export class UpdateKnowledgeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  intent?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  questions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  phrases?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  keywords?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  synonyms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  answer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAuthentication?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresHumanSupport?: boolean;
}

export class KnowledgeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional({ enum: KnowledgeStatus })
  @IsOptional()
  @IsIn(Object.values(KnowledgeStatus))
  status?: KnowledgeStatus;
}

export class TestKnowledgeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}
