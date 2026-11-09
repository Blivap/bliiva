import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  toPaginatedResult,
  type PaginatedResult,
} from '../../common/dto/pagination.dto.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { redactForAnalytics } from './redaction.js';
import { SupportIntelligenceEvent } from './schemas/intelligence-event.schema.js';

export interface IntelligenceEventInput {
  conversationId: string;
  outcome: string;
  category: string | null;
  intent: string | null;
  confidence: number | null;
  latencyMs: number;
  knowledgeId: string | null;
  recognized: boolean;
  unrecognized: boolean;
  clarification: boolean;
  resolved: boolean;
  escalated: boolean;
  lowScore: boolean;
  unresolved: boolean;
  question: string | null;
  forceRedact: boolean;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly events: AnalyticsRepository) {}

  async recordLlm(input: {
    conversationId: string;
    outcome: string;
    model: string | null;
    latencyMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    toolCalls: number;
    retrievalDurationMs: number;
    retrievalTopScore: number | null;
    knowledgeDocumentIds: string[];
    escalated: boolean;
    unavailable: boolean;
    errorCode: string | null;
  }): Promise<void> {
    if (!Types.ObjectId.isValid(input.conversationId)) return;
    await this.events.createLlmEvent({
      conversationId: new Types.ObjectId(input.conversationId),
      outcome: input.outcome,
      modelName: input.model,
      latencyMs: input.latencyMs,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      toolCalls: input.toolCalls,
      retrievalDurationMs: input.retrievalDurationMs,
      retrievalTopScore: input.retrievalTopScore,
      knowledgeDocumentIds: input.knowledgeDocumentIds.slice(0, 10),
      escalated: input.escalated,
      unavailable: input.unavailable,
      errorCode: input.errorCode,
    });
  }

  llmMetrics() {
    return this.events.llmMetrics();
  }

  async record(input: IntelligenceEventInput): Promise<void> {
    const excerpt =
      input.unrecognized || input.unresolved
        ? redactForAnalytics(input.question ?? '', {
            forceRedact: input.forceRedact,
          })
        : null;
    const event: Partial<SupportIntelligenceEvent> = {
      conversationId: new Types.ObjectId(input.conversationId),
      outcome: input.outcome,
      category: input.category,
      intent: input.intent,
      confidence: input.confidence,
      latencyMs: input.latencyMs,
      knowledgeId:
        input.knowledgeId && Types.ObjectId.isValid(input.knowledgeId)
          ? new Types.ObjectId(input.knowledgeId)
          : null,
      recognized: input.recognized,
      unrecognized: input.unrecognized,
      clarification: input.clarification,
      resolved: input.resolved,
      escalated: input.escalated,
      lowScore: input.lowScore,
      unresolved: input.unresolved,
      questionExcerpt: excerpt,
    };
    await this.events.create(event);
  }

  metrics() {
    return this.events.metrics();
  }

  async failures(
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>> {
    const [items, total] = await this.events.findPaginated(
      { unrecognized: true },
      page,
      limit,
    );
    return toPaginatedResult(items, total, page, limit);
  }

  async unresolved(
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>> {
    const [items, total] = await this.events.findPaginated(
      { unresolved: true },
      page,
      limit,
    );
    return toPaginatedResult(items, total, page, limit);
  }
}
