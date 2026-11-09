import { Injectable } from '@nestjs/common';
import { AiSettingsService } from '../../ai/ai-settings.service.js';
import { LlmError } from '../../llm/llm.types.js';
import { mapOllamaError } from '../../llm/providers/ollama/ollama.mapper.js';
import type { EmbeddingProvider } from './embedding.interface.js';

@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly settings: AiSettingsService) {}

  get model(): string {
    return this.settings.current().embedding.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const current = this.settings.current();
    const base = current.llm.baseUrl.replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      current.embedding.timeoutMs,
    );
    try {
      const response = await fetch(`${base}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          keep_alive: current.llm.keepAlive,
        }),
        signal: controller.signal,
      });
      if (response.status === 404) return this.embedLegacy(base, texts);
      if (!response.ok) {
        const message = await readError(response);
        throw mapOllamaError(message, response.status);
      }
      const body = (await response.json()) as { embeddings?: number[][] };
      if (!body.embeddings || body.embeddings.length !== texts.length) {
        throw new LlmError(
          'The embedding response was malformed.',
          'malformed',
        );
      }
      return body.embeddings;
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LlmError('The embedding request timed out.', 'timeout');
      }
      const message = error instanceof Error ? error.message : 'network error';
      throw new LlmError(message, 'runtime_unreachable', true);
    } finally {
      clearTimeout(timer);
    }
  }

  private async embedLegacy(
    base: string,
    texts: string[],
  ): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      const response = await fetch(`${base}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!response.ok) {
        const message = await readError(response);
        throw mapOllamaError(message, response.status);
      }
      const body = (await response.json()) as { embedding?: number[] };
      if (!body.embedding?.length) {
        throw new LlmError(
          'The embedding response was malformed.',
          'malformed',
        );
      }
      vectors.push(body.embedding);
    }
    return vectors;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}
