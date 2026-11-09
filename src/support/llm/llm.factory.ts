import type { AiSettingsService } from '../ai/ai-settings.service.js';
import type { LlmProvider } from './llm.interface.js';
import { LlmError } from './llm.types.js';
import { OllamaProvider } from './providers/ollama/ollama.provider.js';

export function createLlmProvider(settings: AiSettingsService): LlmProvider {
  const provider = settings.current().llm.provider;
  if (provider === 'ollama') return new OllamaProvider(settings);
  throw new LlmError(
    `Unsupported LLM provider: ${provider}`,
    'unsupported_provider',
  );
}
