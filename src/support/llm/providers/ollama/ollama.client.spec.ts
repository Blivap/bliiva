import { describe, expect, it } from 'vitest';
import { LlmError } from '../../llm.types.js';
import { OllamaClient } from './ollama.client.js';

function client(fetchImpl: typeof fetch, timeoutMs = 50) {
  return new OllamaClient({
    baseUrl: 'http://127.0.0.1:11434',
    timeoutMs,
    model: 'qwen3:1.7b',
    temperature: 0.2,
    maxOutputTokens: 32,
    numCtx: 256,
    keepAlive: '5m',
    fetchImpl,
  });
}

describe('OllamaClient', () => {
  it('maps an aborted request to a timeout', async () => {
    const fetchImpl = (async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as typeof fetch;
    await expect(
      client(fetchImpl).chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects malformed JSON', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => {
          throw new Error('not json');
        },
      }) as unknown as Response) as typeof fetch;
    await expect(
      client(fetchImpl).chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(LlmError);
    await expect(
      client(fetchImpl).chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toMatchObject({ code: 'malformed' });
  });

  it('maps a missing model to unavailable', async () => {
    const fetchImpl = (async () =>
      ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'model not found' }),
      }) as unknown as Response) as typeof fetch;
    await expect(
      client(fetchImpl).chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toMatchObject({ code: 'model_unavailable' });
  });
});
