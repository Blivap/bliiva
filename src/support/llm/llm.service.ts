import { Injectable, Logger } from '@nestjs/common';
import type { AiSettings } from '../ai/ai-settings.service.js';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import { LLM_PROVIDER, type LlmProvider } from './llm.interface.js';
import { LlmLimiter } from './llm.limiter.js';
import {
  LlmError,
  type LlmChatRequest,
  type LlmChatResponse,
  type LlmHealth,
  type LlmStreamChunk,
} from './llm.types.js';
import { Inject } from '@nestjs/common';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly limiter: LlmLimiter;

  constructor(
    private readonly settings: AiSettingsService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
  ) {
    this.limiter = new LlmLimiter(this.runtime().maxConcurrent);
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    this.assertFits(request);
    this.limiter.acquire();
    const started = Date.now();
    try {
      const response = await this.withRetries(() =>
        this.provider.chat(request),
      );
      this.logger.log(
        JSON.stringify({
          event: 'support.llm.chat',
          model: response.model,
          durationMs: Date.now() - started,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          toolCalls: response.toolCalls.length,
        }),
      );
      return response;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'support.llm.chat_failed',
          durationMs: Date.now() - started,
          code: error instanceof LlmError ? error.code : 'unknown',
        }),
      );
      throw error;
    } finally {
      this.limiter.release();
    }
  }

  async *stream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    this.assertFits(request);
    this.limiter.acquire();
    try {
      yield* this.provider.stream(request);
    } finally {
      this.limiter.release();
    }
  }

  health(): Promise<LlmHealth> {
    return this.provider.health();
  }

  unload(): Promise<void> {
    return this.provider.unload();
  }

  private async withRetries(
    run: () => Promise<LlmChatResponse>,
  ): Promise<LlmChatResponse> {
    const retries = this.runtime().maxRetries;
    let last: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        last = error;
        const retry =
          error instanceof LlmError && error.transient && attempt < retries;
        if (!retry) break;
      }
    }
    throw last;
  }

  private assertFits(request: LlmChatRequest): void {
    const current = this.runtime();
    const chars = request.messages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    );
    const tokens = Math.ceil(chars / 4);
    if (tokens > current.maxContextTokens) {
      throw new LlmError(
        'The conversation is too long for the configured context window.',
        'context_overflow',
      );
    }
  }

  private runtime(): AiSettings['llm'] {
    return this.settings.current().llm;
  }
}
