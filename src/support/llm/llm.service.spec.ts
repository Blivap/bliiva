import { describe, expect, it, vi } from 'vitest';
import type { AiSettingsService } from '../ai/ai-settings.service.js';
import type { LlmProvider } from './llm.interface.js';
import { LlmService } from './llm.service.js';
import { LlmError } from './llm.types.js';

function settings(overrides: Record<string, unknown> = {}) {
  return {
    current: () => ({
      llm: {
        enabled: true,
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen3:1.7b',
        alternativeModel: 'qwen3:4b',
        temperature: 0.2,
        timeoutMs: 1000,
        maxContextMessages: 10,
        maxOutputTokens: 128,
        maxContextTokens: 64,
        numCtx: 64,
        maxConcurrent: 1,
        maxRetries: 1,
        maxToolCalls: 2,
        keepAlive: '5m',
        ...overrides,
      },
      embedding: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        timeoutMs: 1000,
        batchSize: 2,
      },
      rag: {
        enabled: true,
        topK: 5,
        minRelevanceScore: 0.55,
        chunkTokens: 500,
        chunkOverlapTokens: 80,
        charsPerToken: 4,
        maxCandidates: 100,
        semanticWeight: 0.7,
        maxChunkChars: 800,
        vectorStore: 'mongodb',
        qdrantUrl: '',
        qdrantCollection: 'bliiva_knowledge',
      },
    }),
  } as AiSettingsService;
}

describe('LlmService', () => {
  it('returns a successful model response', async () => {
    const provider: LlmProvider = {
      name: 'ollama',
      chat: vi.fn(async () => ({
        message: { role: 'assistant' as const, content: 'ok' },
        toolCalls: [],
        promptTokens: 3,
        completionTokens: 2,
        durationMs: 5,
        model: 'qwen3:1.7b',
      })),
      stream: async function* () {},
      health: async () => ({
        ok: true,
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen3:1.7b',
        runtimeReachable: true,
        modelAvailable: true,
        message: 'ok',
      }),
      unload: async () => undefined,
    };
    const service = new LlmService(
      settings({ maxContextTokens: 1000 }),
      provider,
    );
    const response = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(response.message.content).toBe('ok');
  });

  it('rejects context overflow', async () => {
    const provider = {
      name: 'ollama',
      chat: vi.fn(),
      stream: async function* () {},
      health: vi.fn(),
      unload: vi.fn(),
    } as unknown as LlmProvider;
    const service = new LlmService(settings({ maxContextTokens: 2 }), provider);
    await expect(
      service.chat({
        messages: [
          { role: 'user', content: 'this message is definitely too long' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'context_overflow' });
  });

  it('limits concurrent requests', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider: LlmProvider = {
      name: 'ollama',
      chat: vi.fn(async () => {
        await gate;
        return {
          message: { role: 'assistant' as const, content: 'done' },
          toolCalls: [],
          promptTokens: 1,
          completionTokens: 1,
          durationMs: 1,
          model: 'qwen3:1.7b',
        };
      }),
      stream: async function* () {},
      health: async () => ({
        ok: true,
        provider: 'ollama',
        baseUrl: 'x',
        model: 'qwen3:1.7b',
        runtimeReachable: true,
        modelAvailable: true,
        message: 'ok',
      }),
      unload: async () => undefined,
    };
    const service = new LlmService(
      settings({ maxConcurrent: 1, maxContextTokens: 1000 }),
      provider,
    );
    const first = service.chat({
      messages: [{ role: 'user', content: 'one' }],
    });
    await expect(
      service.chat({ messages: [{ role: 'user', content: 'two' }] }),
    ).rejects.toBeInstanceOf(LlmError);
    release();
    await first;
  });

  it('retries transient failures once', async () => {
    const chat = vi
      .fn()
      .mockRejectedValueOnce(new LlmError('loading', 'model_loading', true))
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'ready' },
        toolCalls: [],
        promptTokens: 1,
        completionTokens: 1,
        durationMs: 1,
        model: 'qwen3:1.7b',
      });
    const provider = {
      name: 'ollama',
      chat,
      stream: async function* () {},
      health: vi.fn(),
      unload: vi.fn(),
    } as unknown as LlmProvider;
    const service = new LlmService(
      settings({ maxRetries: 1, maxContextTokens: 1000 }),
      provider,
    );
    const response = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(response.message.content).toBe('ready');
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
