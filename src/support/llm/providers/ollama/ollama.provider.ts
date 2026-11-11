import { Injectable } from '@nestjs/common';
import { AiSettingsService } from '../../../ai/ai-settings.service.js';
import type { LlmProvider } from '../../llm.interface.js';
import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmHealth,
  LlmStreamChunk,
} from '../../llm.types.js';
import { OllamaClient } from './ollama.client.js';

@Injectable()
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  private client: OllamaClient | null = null;
  private clientBaseUrl: string | null = null;
  private clientModel: string | null = null;

  constructor(private readonly settings: AiSettingsService) {}

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    return this.runtime().chat(request);
  }

  stream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    return this.runtime().stream(request);
  }

  async health(): Promise<LlmHealth> {
    const current = this.settings.current().llm;
    const health: LlmHealth = {
      ok: false,
      provider: this.name,
      baseUrl: current.baseUrl,
      model: current.model,
      runtimeReachable: false,
      modelAvailable: false,
      message: 'Ollama is not reachable.',
    };
    try {
      const names = await this.runtime().tags();
      health.runtimeReachable = true;
      health.modelAvailable = names.some(
        (name) =>
          name === current.model || name.startsWith(`${current.model}:`),
      );
      health.ok = health.modelAvailable;
      health.message = health.modelAvailable
        ? 'Model is available.'
        : `Runtime is up. ${current.model} is not pulled.`;
    } catch (error) {
      health.message = error instanceof Error ? error.message : 'unreachable';
    }
    return health;
  }

  async unload(): Promise<void> {
    const current = this.settings.current().llm;
    await this.runtime().unload(current.model);
  }

  private runtime(): OllamaClient {
    const current = this.settings.current().llm;
    const baseUrl = current.baseUrl.replace(/\/$/, '');
    const needsRebuild =
      !this.client ||
      this.clientBaseUrl !== baseUrl ||
      this.clientModel !== current.model;
    if (needsRebuild) {
      this.client = new OllamaClient({
        baseUrl,
        timeoutMs: current.timeoutMs,
        model: current.model,
        temperature: current.temperature,
        maxOutputTokens: current.maxOutputTokens,
        numCtx: current.numCtx,
        keepAlive: current.keepAlive,
      });
      this.clientBaseUrl = baseUrl;
      this.clientModel = current.model;
    }
    return this.client!;
  }
}
