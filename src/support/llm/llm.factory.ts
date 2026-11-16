import type { AiSettingsService } from '../ai/ai-settings.service.js';
import type { LlmProvider } from './llm.interface.js';
import { LlmError } from './llm.types.js';
import { OrderedChatProvider } from './providers/openai-compatible/ordered-chat.provider.js';
import { OllamaProvider } from './providers/ollama/ollama.provider.js';

export function createLlmProvider(settings: AiSettingsService): LlmProvider {
  const llm = settings.current().llm;
  const ollama =
    llm.provider === 'ollama' ? new OllamaProvider(settings) : null;
  if (llm.chatEndpoints.length === 0) {
    if (ollama) return ollama;
    throw new LlmError(
      `Unsupported LLM provider: ${llm.provider}`,
      'unsupported_provider',
    );
  }
  return new OrderedChatProvider(llm.chatEndpoints, ollama);
}
