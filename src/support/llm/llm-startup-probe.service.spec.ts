import { describe, expect, it, vi } from 'vitest';
import type { AiSettingsService } from '../ai/ai-settings.service.js';
import type { LlmService } from './llm.service.js';
import { LlmStartupProbeService } from './llm-startup-probe.service.js';
import { LlmError } from './llm.types.js';

function settings(enabled: boolean) {
  return {
    current: () => ({
      llm: {
        enabled,
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen3:1.7b',
      },
    }),
  } as unknown as AiSettingsService;
}

describe('LlmStartupProbeService', () => {
  it('warns when LLM is disabled', async () => {
    const health = vi.fn();
    const chat = vi.fn();
    const llm = { health, chat } as unknown as LlmService;
    const probe = new LlmStartupProbeService(settings(false), llm);
    const warn = vi.spyOn(
      (probe as unknown as { logger: { warn: (...args: unknown[]) => void } })
        .logger,
      'warn',
    );

    const result = await probe.probe();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('llm_disabled');
    expect(result.utilized).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('LLM_ENABLED=false'),
    );
    expect(health).not.toHaveBeenCalled();
  });

  it('warns when health check fails', async () => {
    const health = vi.fn(async () => ({
      ok: false,
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:1.7b',
      runtimeReachable: false,
      modelAvailable: false,
      message: 'Ollama is not reachable.',
    }));
    const chat = vi.fn();
    const llm = { health, chat } as unknown as LlmService;
    const probe = new LlmStartupProbeService(settings(true), llm);

    const result = await probe.probe();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('health_failed');
    expect(chat).not.toHaveBeenCalled();
  });

  it('logs OK when probe chat returns content', async () => {
    const health = vi.fn(async () => ({
      ok: true,
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:1.7b',
      runtimeReachable: true,
      modelAvailable: true,
      message: 'Model is available.',
    }));
    const chat = vi.fn(async () => ({
      message: { role: 'assistant', content: 'OK' },
      toolCalls: [],
      promptTokens: 1,
      completionTokens: 1,
      durationMs: 10,
      model: 'qwen3:1.7b',
    }));
    const llm = { health, chat } as unknown as LlmService;
    const probe = new LlmStartupProbeService(settings(true), llm);
    const log = vi.spyOn(
      (probe as unknown as { logger: { log: (...args: unknown[]) => void } })
        .logger,
      'log',
    );

    const result = await probe.probe();

    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ok');
    expect(chat).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('LLM startup probe OK'),
    );
  });

  it('warns when probe chat throws', async () => {
    const health = vi.fn(async () => ({
      ok: true,
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:1.7b',
      runtimeReachable: true,
      modelAvailable: true,
      message: 'Model is available.',
    }));
    const chat = vi.fn(async () => {
      throw new LlmError('timed out', 'timeout', true);
    });
    const llm = { health, chat } as unknown as LlmService;
    const probe = new LlmStartupProbeService(settings(true), llm);

    const result = await probe.probe();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('chat_failed');
  });

  it('readiness reuses the last probe result', async () => {
    const health = vi.fn(async () => ({
      ok: true,
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:1.7b',
      runtimeReachable: true,
      modelAvailable: true,
      message: 'Model is available.',
    }));
    const chat = vi.fn(async () => ({
      message: { role: 'assistant', content: 'OK' },
      toolCalls: [],
      promptTokens: 1,
      completionTokens: 1,
      durationMs: 10,
      model: 'qwen3:1.7b',
    }));
    const llm = { health, chat } as unknown as LlmService;
    const probe = new LlmStartupProbeService(settings(true), llm);

    await probe.probe();
    const again = await probe.readiness();

    expect(again.ok).toBe(true);
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
