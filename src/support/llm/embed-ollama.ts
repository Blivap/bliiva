import { spawn } from 'node:child_process';
import { Logger } from '@nestjs/common';

/** Installed by the API image from the official Ollama image. */
export const OLLAMA_BIN = '/usr/bin/ollama';

const DEAD_HOST = /bliiva-llm\.internal/i;
/** Smallest instance that can keep Node and Qwen3 1.7B resident. */
const MIN_BYTES = 3_000_000_000;
/** Qwen3 4B needs a larger instance; smaller boxes use 1.7B. */
const FOUR_B_BYTES = 6_000_000_000;

export type EmbeddedOllamaPlan =
  | { start: false; reason: 'external-host' | 'binary-missing' | 'low-memory' }
  | { start: true; model: string; baseUrl: 'http://127.0.0.1:11434' };

/**
 * The live service still has LLM_BASE_URL=http://bliiva-llm.internal:11434, and
 * that name does not resolve. When this image contains Ollama and the instance
 * has enough RAM, serve the model on localhost instead of crashing the API.
 */
export function embeddedOllamaPlan(input: {
  baseUrl: string | undefined;
  model: string | undefined;
  totalBytes: number;
  binaryPresent: boolean;
}): EmbeddedOllamaPlan {
  const baseUrl = input.baseUrl?.trim() ?? '';
  if (!DEAD_HOST.test(baseUrl)) {
    return { start: false, reason: 'external-host' };
  }
  if (!input.binaryPresent) {
    return { start: false, reason: 'binary-missing' };
  }
  if (input.totalBytes < MIN_BYTES) {
    return { start: false, reason: 'low-memory' };
  }
  const requested = input.model?.trim() || 'qwen3:4b';
  const model = input.totalBytes < FOUR_B_BYTES ? 'qwen3:1.7b' : requested;
  return { start: true, model, baseUrl: 'http://127.0.0.1:11434' };
}

export function prepareEmbeddedOllama(input: {
  totalBytes: number;
  binaryPresent: boolean;
}): void {
  const plan = embeddedOllamaPlan({
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
    totalBytes: input.totalBytes,
    binaryPresent: input.binaryPresent,
  });
  if (!plan.start) {
    if (plan.reason !== 'external-host') {
      Logger.warn(
        `Embedded Ollama skipped (${plan.reason}, ${input.totalBytes} bytes). baseUrl=${process.env.LLM_BASE_URL ?? ''}`,
        'Bootstrap',
      );
    }
    return;
  }

  process.env.LLM_BASE_URL = plan.baseUrl;
  process.env.LLM_MODEL = plan.model;
  const env = {
    ...process.env,
    HOME: process.env.HOME || '/home/node',
    LD_LIBRARY_PATH: '/usr/lib/ollama',
    OLLAMA_HOST: '127.0.0.1:11434',
    OLLAMA_KEEP_ALIVE: process.env.LLM_KEEP_ALIVE ?? '30m',
    OLLAMA_MAX_LOADED_MODELS: '1',
    OLLAMA_NUM_PARALLEL: '1',
  };
  const serve = spawn(OLLAMA_BIN, ['serve'], { env, stdio: 'inherit' });
  serve.unref();
  void pullWhenReady(env, plan.model);
  Logger.log(
    `Embedded Ollama starting model ${plan.model} at ${plan.baseUrl}`,
    'Bootstrap',
  );
}

async function pullWhenReady(
  env: NodeJS.ProcessEnv,
  model: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags');
      if (response.ok) {
        const pull = spawn(OLLAMA_BIN, ['pull', model], {
          env,
          stdio: 'inherit',
        });
        pull.unref();
        return;
      }
    } catch {
      // Ollama is still binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  Logger.warn(
    `Embedded Ollama did not open port 11434; model ${model} was not pulled`,
    'Bootstrap',
  );
}
