import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import { SUPPORT_CATEGORY_SLUGS } from '../../common/constants/support-categories.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { DocumentIngestionService } from './ingestion/document-ingestion.service.js';
import { RagService } from './rag.service.js';

class ReindexKnowledgeDto {
  @ApiPropertyOptional({ description: 'Reserved for future selective reindex' })
  @IsOptional()
  @IsString()
  documentId?: string;
}

class IngestDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  documentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(100000)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;
}

class TestRetrievalDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({ enum: SUPPORT_CATEGORY_SLUGS })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORY_SLUGS)
  category?: string;
}

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/rag')
export class RagAdminController {
  constructor(
    private readonly ingestion: DocumentIngestionService,
    private readonly rag: RagService,
  ) {}

  @Post('reindex')
  @ApiOperation({
    summary: 'Re-embed published knowledge into the vector store',
  })
  async reindex(@Body() _dto: ReindexKnowledgeDto) {
    return okResponse('Knowledge reindexed', await this.ingestion.reindexAll());
  }

  @Post('ingest')
  @ApiOperation({
    summary: 'Ingest an approved support document into the vector store',
  })
  async ingest(@Body() dto: IngestDocumentDto) {
    return okResponse(
      'Document ingested',
      await this.ingestion.ingestSubmission(dto),
    );
  }

  @Post('test')
  @ApiOperation({ summary: 'Test hybrid RAG retrieval for a sample message' })
  async test(@Body() dto: TestRetrievalDto) {
    const hit = await this.rag.retrieve({
      text: dto.message,
      category: dto.category,
    });
    return okResponse('RAG retrieval result', {
      durationMs: hit.durationMs,
      semanticAvailable: hit.semanticAvailable,
      embeddingMismatch: hit.embeddingMismatch,
      failed: hit.failed,
      chunks: hit.chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        title: chunk.title,
        category: chunk.category,
        version: chunk.version,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        preview: chunk.content.slice(0, 240),
      })),
    });
  }
}
