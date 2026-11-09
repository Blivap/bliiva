import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SUPPORT_CATEGORY_SLUGS } from '../../../common/constants/support-categories.js';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { IntentSensitivity } from '../../../common/enums/index.js';
import { EscalationPolicy } from '../interfaces/intent-recognizer.interface.js';

const POLICIES = Object.values(EscalationPolicy);

export class IntentFieldsDto {
  @ApiProperty({ example: 'ACCOUNT_LOGIN' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,63}$/)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  description!: string;

  @ApiProperty({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  keywords!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  phrases!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  synonyms!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  examples!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  negativeKeywords?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  priority?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  clarificationLabel?: string;

  @ApiPropertyOptional({ enum: IntentSensitivity })
  @IsOptional()
  @IsIn(Object.values(IntentSensitivity))
  sensitivity?: IntentSensitivity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAuthentication?: boolean;

  @ApiPropertyOptional({ enum: POLICIES })
  @IsOptional()
  @IsIn(POLICIES)
  escalationPolicy?: string;
}

export class UpdateIntentDto extends PartialType(IntentFieldsDto) {}

export class IntentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  enabled?: boolean;
}

export class TestIntentDto {
  @ApiProperty({ example: "I can't login." })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
