import { describe, expect, it } from 'vitest';
import { LlmError } from '../../llm.types.js';
import {
  fromOllamaChatResponse,
  mapOllamaError,
  toOllamaMessages,
} from './ollama.mapper.js';

describe('ollama mapper', () => {
  it('maps a successful chat response', () => {
    const response = fromOllamaChatResponse(
      {
        model: 'qwen3:1.7b',
        message: { role: 'assistant', content: 'Hello from Blivap support.' },
        prompt_eval_count: 12,
        eval_count: 8,
      },
      40,
      'qwen3:1.7b',
    );
    expect(response.message.content).toContain('Blivap');
    expect(response.promptTokens).toBe(12);
    expect(response.durationMs).toBe(40);
  });

  it('rejects empty responses', () => {
    expect(() =>
      fromOllamaChatResponse(
        { message: { role: 'assistant', content: '   ' } },
        1,
        'qwen3:1.7b',
      ),
    ).toThrow(LlmError);
  });

  it('falls back to thinking when content is empty', () => {
    const response = fromOllamaChatResponse(
      {
        model: 'qwen3:1.7b',
        message: {
          role: 'assistant',
          content: '',
          thinking: 'Open Wallet in the app to check your balance.',
        },
      },
      20,
      'qwen3:1.7b',
    );
    expect(response.message.content).toContain('Wallet');
  });

  it('maps loading and unavailable errors', () => {
    expect(mapOllamaError('llm server loading', 503).code).toBe(
      'model_loading',
    );
    expect(mapOllamaError('model not found', 404).code).toBe(
      'model_unavailable',
    );
  });

  it('serializes tool messages for Ollama', () => {
    const messages = toOllamaMessages([
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: '1',
            name: 'get_wallet_summary',
            arguments: {},
          },
        ],
      },
    ]);
    expect(messages[0].tool_calls).toEqual([
      {
        id: '1',
        function: { name: 'get_wallet_summary', arguments: {} },
      },
    ]);
  });
});
