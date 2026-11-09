import { LlmError } from '../../llm.types.js';
import type { LlmChatRequest, LlmStreamChunk } from '../../llm.types.js';
import {
  fromOllamaChatResponse,
  fromOllamaStreamLine,
  mapOllamaError,
  toOllamaMessages,
  toOllamaTools,
} from './ollama.mapper.js';
import type { OllamaChatBody } from './ollama.types.js';

export interface OllamaClientOptions {
  baseUrl: string;
  timeoutMs: number;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  numCtx: number;
  keepAlive: string;
  fetchImpl?: typeof fetch;
}

export class OllamaClient {
  constructor(private readonly options: OllamaClientOptions) {}

  async chat(request: LlmChatRequest) {
    const started = Date.now();
    const response = await this.post('/api/chat', this.body(request, false));
    const payload = await readJson(response);
    return fromOllamaChatResponse(
      payload,
      Date.now() - started,
      this.options.model,
    );
  }

  async *stream(request: LlmChatRequest): AsyncIterable<LlmStreamChunk> {
    const response = await this.post('/api/chat', this.body(request, true));
    if (!response.body) {
      throw new LlmError('The model stream was empty.', 'empty_response');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const chunk = fromOllamaStreamLine(line);
          if (chunk) yield chunk;
        }
      }
      const tail = fromOllamaStreamLine(buffer);
      if (tail) yield tail;
    } finally {
      reader.releaseLock();
    }
  }

  async tags(): Promise<string[]> {
    const response = await this.send('/api/tags', { method: 'GET' });
    const payload = (await readJson(response)) as {
      models?: Array<{ name?: string }>;
    };
    return (payload.models ?? [])
      .map((model) => model.name ?? '')
      .filter((name) => name.length > 0);
  }

  async unload(model: string): Promise<void> {
    await this.post('/api/generate', {
      model,
      keep_alive: 0,
      prompt: ' ',
      stream: false,
    });
  }

  private body(request: LlmChatRequest, stream: boolean): OllamaChatBody {
    return {
      model: this.options.model,
      messages: toOllamaMessages(request.messages),
      stream,
      tools: request.tools?.length ? toOllamaTools(request.tools) : undefined,
      format: request.format,
      keep_alive: this.options.keepAlive,
      // Support chat needs the answer in content, not a long thinking trace.
      think: false,
      options: {
        temperature: request.temperature ?? this.options.temperature,
        num_predict: request.maxOutputTokens ?? this.options.maxOutputTokens,
        num_ctx: this.options.numCtx,
      },
    };
  }

  private post(path: string, body: unknown) {
    return this.send(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const fetchImpl = this.options.fetchImpl ?? fetch;
      const response = await fetchImpl(`${this.options.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await readError(response);
        throw mapOllamaError(message, response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if (isAbort(error)) {
        throw new LlmError('The model request timed out.', 'timeout');
      }
      const message = error instanceof Error ? error.message : 'network error';
      throw new LlmError(message, 'runtime_unreachable', true);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new LlmError('The model returned malformed JSON.', 'malformed');
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

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}
