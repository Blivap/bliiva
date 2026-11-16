import type { ChatEndpointConfig } from '../../../../config/llm-endpoints.js';
import type { LlmProvider } from '../../llm.interface.js';
import { LlmError } from '../../llm.types.js';
import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmHealth,
  LlmStreamChunk,
} from '../../llm.types.js';
import {
  OPENAI_CHAT_TIMEOUT_MS,
  OpenAiCompatibleClient,
} from './openai-compatible.client.js';

/**
 * Tries OpenAI-compatible endpoints in order, then Ollama when it is configured.
 * A failure of every provider is returned to the caller as one error.
 */
export class OrderedChatProvider implements LlmProvider {
  readonly name = 'ordered-fallback';

  constructor(
    private readonly endpoints: ChatEndpointConfig[],
    private readonly ollama: LlmProvider | null,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    let last: unknown;
    for (const endpoint of this.endpoints) {
      try {
        return await new OpenAiCompatibleClient({
          endpoint,
          timeoutMs: OPENAI_CHAT_TIMEOUT_MS,
          fetchImpl: this.fetchImpl,
        }).chat(request);
      } catch (error) {
        last = error;
      }
    }
    if (this.ollama) {
      try {
        return await this.ollama.chat(request);
      } catch (error) {
        last = error;
      }
    }
    if (last instanceof LlmError) {
      throw new LlmError(last.message, 'runtime_unreachable', false);
    }
    throw new LlmError(
      'All chat providers failed.',
      'runtime_unreachable',
      false,
    );
  }

  async *stream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const response = await this.chat(request);
    yield {
      content: response.message.content,
      done: true,
      toolCalls: response.toolCalls,
    };
  }

  async health(): Promise<LlmHealth> {
    const first = this.endpoints[0];
    if (first) {
      const client = new OpenAiCompatibleClient({
        endpoint: first,
        timeoutMs: OPENAI_CHAT_TIMEOUT_MS,
        fetchImpl: this.fetchImpl,
      });
      try {
        const ok = await client.ping();
        if (ok) {
          return {
            ok: true,
            provider: this.name,
            baseUrl: first.url,
            model: first.model,
            runtimeReachable: true,
            modelAvailable: true,
            message: 'Endpoint is reachable.',
          };
        }
      } catch {
        // Fall through to Ollama when it is the optional provider.
      }
    }
    if (this.ollama) return this.ollama.health();
    return {
      ok: false,
      provider: this.name,
      baseUrl: first?.url ?? '',
      model: first?.model ?? '',
      runtimeReachable: false,
      modelAvailable: false,
      message: 'No chat provider is reachable.',
    };
  }

  async unload(): Promise<void> {
    if (this.ollama) await this.ollama.unload();
  }
}
