import { describe, expect, it } from 'vitest';
import { embeddedOllamaPlan } from './embed-ollama.js';

const GB = 1_000_000_000;

describe('embeddedOllamaPlan', () => {
  it('starts on localhost when the configured host does not resolve', () => {
    expect(
      embeddedOllamaPlan({
        baseUrl: 'http://bliiva-llm.internal:11434',
        model: 'qwen3:4b',
        totalBytes: 8 * GB,
        binaryPresent: true,
      }),
    ).toEqual({
      start: true,
      model: 'qwen3:4b',
      baseUrl: 'http://127.0.0.1:11434',
    });
  });

  it('uses the smaller model when the instance cannot hold 4B', () => {
    expect(
      embeddedOllamaPlan({
        baseUrl: 'http://bliiva-llm.internal:11434',
        model: 'qwen3:4b',
        totalBytes: 4 * GB,
        binaryPresent: true,
      }),
    ).toMatchObject({ start: true, model: 'qwen3:1.7b' });
  });

  it('leaves a reachable Ollama host alone', () => {
    expect(
      embeddedOllamaPlan({
        baseUrl: 'http://ollama:11434',
        model: 'qwen3:4b',
        totalBytes: 8 * GB,
        binaryPresent: true,
      }).start,
    ).toBe(false);
  });

  it('does not start when RAM cannot hold a model', () => {
    expect(
      embeddedOllamaPlan({
        baseUrl: 'http://bliiva-llm.internal:11434',
        model: 'qwen3:4b',
        totalBytes: 2 * GB,
        binaryPresent: true,
      }),
    ).toEqual({ start: false, reason: 'low-memory' });
  });

  it('does not start when the image has no Ollama binary', () => {
    expect(
      embeddedOllamaPlan({
        baseUrl: 'http://bliiva-llm.internal:11434',
        model: 'qwen3:4b',
        totalBytes: 8 * GB,
        binaryPresent: false,
      }),
    ).toEqual({ start: false, reason: 'binary-missing' });
  });
});
