import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../../analytics/analytics.service.js';

export interface LlmMetricInput {
  kind: 'chat' | 'tool' | 'retrieve' | 'escalation';
  model: string | null;
  latencyMs: number;
  success: boolean;
  errorCode?: string | null;
  relevance?: number | null;
  knowledgeIds?: string[];
  conversationId?: string;
}

@Injectable()
export class LlmMetricsService {
  private chats = 0;
  private chatErrors = 0;
  private chatLatencyMs = 0;
  private toolCalls = 0;
  private toolFailures = 0;
  private retrievals = 0;
  private escalations = 0;

  constructor(private readonly analytics: AnalyticsService) {}

  async record(input: LlmMetricInput): Promise<void> {
    if (input.kind === 'chat' || input.kind === 'escalation') {
      this.chats += 1;
      this.chatLatencyMs += input.latencyMs;
      if (!input.success) this.chatErrors += 1;
      if (input.kind === 'escalation') this.escalations += 1;
    } else if (input.kind === 'tool') {
      this.toolCalls += 1;
      if (!input.success) this.toolFailures += 1;
    } else {
      this.retrievals += 1;
    }

    if (
      input.conversationId &&
      (input.kind === 'chat' || input.kind === 'escalation')
    ) {
      await this.analytics.recordLlm({
        conversationId: input.conversationId,
        outcome: input.kind,
        model: input.model,
        latencyMs: input.latencyMs,
        promptTokens: null,
        completionTokens: null,
        toolCalls: 0,
        retrievalDurationMs: 0,
        retrievalTopScore: input.relevance ?? null,
        knowledgeDocumentIds: input.knowledgeIds ?? [],
        escalated: input.kind === 'escalation',
        unavailable: input.errorCode === 'model_unavailable',
        errorCode: input.errorCode ?? null,
      });
    }
  }

  snapshot() {
    return {
      chats: this.chats,
      chatErrors: this.chatErrors,
      averageChatLatencyMs: this.chats
        ? Math.round(this.chatLatencyMs / this.chats)
        : null,
      toolCalls: this.toolCalls,
      toolFailures: this.toolFailures,
      retrievals: this.retrievals,
      escalations: this.escalations,
    };
  }
}
