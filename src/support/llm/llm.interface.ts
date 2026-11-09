import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmHealth,
  LlmStreamChunk,
} from './llm.types.js';

/**
 * Provider-neutral chat runtime. Conversation orchestration depends on this
 * contract, not on an Ollama response body.
 */
export interface LlmProvider {
  readonly name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
  stream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk>;
  health(): Promise<LlmHealth>;
  unload(): Promise<void>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
