import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/auth/admin.guard.js';
import { SupportAuthGuard } from '../../common/auth/support-auth.guard.js';
import { okResponse } from '../../common/interfaces/api-response.interface.js';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import { DocumentIngestionService } from '../rag/ingestion/document-ingestion.service.js';
import { RagService } from '../rag/rag.service.js';
import { ToolsRegistry } from '../tools/tools.registry.js';
import { LlmMetricsService } from './analytics/llm-metrics.service.js';
import {
  RetrieveKnowledgeDto,
  SubmitKnowledgeDocumentDto,
} from './dto/llm-admin.dto.js';
import { LlmService } from './llm.service.js';
import { SUPPORT_PROMPT_VERSION } from './prompts/index.js';
import { randomUUID } from 'node:crypto';

@ApiTags('support-admin')
@ApiSecurity('support-service')
@UseGuards(SupportAuthGuard, AdminGuard)
@Controller('support/admin/llm')
export class LlmAdminController {
  constructor(
    private readonly llm: LlmService,
    private readonly settings: AiSettingsService,
    private readonly rag: RagService,
    private readonly ingestion: DocumentIngestionService,
    private readonly tools: ToolsRegistry,
    private readonly metrics: LlmMetricsService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check the self-hosted model runtime' })
  async health() {
    const status = await this.llm.health();
    return okResponse(
      status.ok ? 'Model runtime ready' : 'Model runtime degraded',
      {
        ...status,
        baseUrl: safeUrl(status.baseUrl),
      },
    );
  }

  @Get('config')
  @ApiOperation({ summary: 'Show non-secret model and retrieval settings' })
  config() {
    const current = this.settings.current();
    return okResponse('LLM configuration', {
      enabled: current.llm.enabled,
      provider: current.llm.provider,
      baseUrl: safeUrl(current.llm.baseUrl),
      model: current.llm.model,
      alternativeModel: current.llm.alternativeModel,
      temperature: current.llm.temperature,
      timeoutMs: current.llm.timeoutMs,
      maxContextMessages: current.llm.maxContextMessages,
      maxOutputTokens: current.llm.maxOutputTokens,
      maxContextTokens: current.llm.maxContextTokens,
      concurrency: current.llm.maxConcurrent,
      maxToolCalls: current.llm.maxToolCalls,
      embeddingModel: current.embedding.model,
      ragEnabled: current.rag.enabled,
      topK: current.rag.topK,
      minRelevanceScore: current.rag.minRelevanceScore,
      vectorStore: current.rag.vectorStore,
      qdrantConfigured: Boolean(current.rag.qdrantUrl),
      promptVersion: SUPPORT_PROMPT_VERSION,
    });
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Support-model quality counters for this process' })
  metricsView() {
    return okResponse('LLM metrics', this.metrics.snapshot());
  }

  @Get('tools')
  @ApiOperation({ summary: 'List tools the model is allowed to request' })
  toolsView() {
    return okResponse('LLM tools', this.tools.list());
  }

  @Post('reindex')
  @ApiOperation({ summary: 'Re-embed published support knowledge' })
  async reindex() {
    return okResponse(
      'Knowledge reindex finished',
      await this.ingestion.reindexAll(),
    );
  }

  @Post('retrieve')
  @ApiOperation({ summary: 'Test retrieval without calling the chat model' })
  async retrieve(@Body() dto: RetrieveKnowledgeDto) {
    const hit = await this.rag.retrieve({
      text: dto.query,
      category: dto.category,
    });
    return okResponse('Retrieval result', {
      failed: hit.failed,
      semanticAvailable: hit.semanticAvailable,
      embeddingMismatch: hit.embeddingMismatch,
      missingEmbeddings: hit.missingEmbeddings,
      durationMs: hit.durationMs,
      chunks: hit.chunks.map((chunk) => ({
        documentId: chunk.documentId,
        title: chunk.title,
        category: chunk.category,
        version: chunk.version,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        content: this.rag.clip(chunk.content),
      })),
    });
  }

  @Post('documents')
  @ApiOperation({
    summary: 'Ingest an approved text document into the knowledge index',
  })
  async submit(@Body() dto: SubmitKnowledgeDocumentDto) {
    const report = await this.ingestion.ingestSubmission({
      documentId: randomUUID(),
      title: dto.title,
      category: dto.category,
      text: dto.content,
      filename: dto.filename,
      language: dto.language,
    });
    return okResponse('Document ingestion finished', report);
  }

  @Post('unload')
  @ApiOperation({ summary: 'Ask the runtime to unload the chat model' })
  async unload() {
    try {
      await this.llm.unload();
      return okResponse('Model unload requested', { unloaded: true });
    } catch {
      return okResponse('Model runtime did not unload the model', {
        unloaded: false,
      });
    }
  }
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return 'invalid-url';
  }
}
