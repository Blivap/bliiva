import { describe, expect, it, vi } from 'vitest';
import type { ChatEndpointConfig } from '../../../../config/llm-endpoints.js';
import { readChatEndpoints } from '../../../../config/llm-endpoints.js';
import type { LlmProvider } from '../../llm.interface.js';
import { LlmError } from '../../llm.types.js';
import {
  OPENAI_CHAT_TIMEOUT_MS,
  OpenAiCompatibleClient,
} from './openai-compatible.client.js';
import { OrderedChatProvider } from './ordered-chat.provider.js';

const first: ChatEndpointConfig = {
  url: 'https://primary.example/v1',
  apiKey: 'key-1',
  model: 'model-a',
};

const second: ChatEndpointConfig = {
  url: 'https://backup.example/v1',
  apiKey: '',
  model: 'model-b',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'error',
    json: async () => body,
  } as Response;
}

describe('readChatEndpoints', () => {
  it('keeps complete slots in order and skips gaps', () => {
    const endpoints = readChatEndpoints({
      LLM_URL_2: 'https://backup.example/v1/',
      LLM_MODEL_2: 'model-b',
      LLM_URL_1: 'https://primary.example/v1',
      LLM_KEY_1: 'key-1',
      LLM_MODEL_1: 'model-a',
      LLM_URL_3: 'not-a-url',
      LLM_MODEL_3: 'skipped',
    });
    expect(endpoints.map((item) => item.model)).toEqual(['model-a', 'model-b']);
    expect(endpoints[1]?.url).toBe('https://backup.example/v1');
    expect(endpoints[0]?.apiKey).toBe('key-1');
  });
});

describe('OpenAiCompatibleClient', () => {
  it('uses a 15 second timeout', () => {
    expect(OPENAI_CHAT_TIMEOUT_MS).toBe(15000);
  });

  it('posts an OpenAI chat completion and maps tool calls', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        model: 'model-a',
        choices: [
          {
            message: {
              content: 'Your balance is ready.',
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'get_wallet_summary',
                    arguments: '{}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 4, completion_tokens: 3 },
      }),
    ) as unknown as typeof fetch;
    const client = new OpenAiCompatibleClient({
      endpoint: first,
      fetchImpl,
    });
    const response = await client.chat({
      messages: [{ role: 'user', content: 'balance' }],
    });
    expect(response.model).toBe('model-a');
    expect(response.toolCalls[0]?.name).toBe('get_wallet_summary');
    const [url, init] = (
      fetchImpl as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://primary.example/v1/chat/completions');
    expect(init.headers).toMatchObject({ authorization: 'Bearer key-1' });
  });
});

describe('OrderedChatProvider', () => {
  it('falls through to the next endpoint, then Ollama', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: 'down' } }, 503),
    ) as unknown as typeof fetch;
    const ollamaChat = vi.fn(async () => ({
      message: { role: 'assistant' as const, content: 'from ollama' },
      toolCalls: [],
      promptTokens: 1,
      completionTokens: 1,
      durationMs: 2,
      model: 'qwen3:1.7b',
    }));
    const ollama: LlmProvider = {
      name: 'ollama',
      chat: ollamaChat,
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
    const provider = new OrderedChatProvider(
      [first, second],
      ollama,
      fetchImpl,
    );
    const response = await provider.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(response.message.content).toBe('from ollama');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(ollamaChat).toHaveBeenCalledOnce();
  });

  it('fails once when every provider fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const ollama: LlmProvider = {
      name: 'ollama',
      chat: vi.fn(async () => {
        throw new LlmError('ollama down', 'runtime_unreachable', true);
      }),
      stream: async function* () {},
      health: async () => ({
        ok: false,
        provider: 'ollama',
        baseUrl: '',
        model: '',
        runtimeReachable: false,
        modelAvailable: false,
        message: 'down',
      }),
      unload: async () => undefined,
    };
    const provider = new OrderedChatProvider([first], ollama, fetchImpl);
    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toMatchObject({ code: 'runtime_unreachable', transient: false });
  });
});
