import type { ChatEndpointConfig } from '../../../../config/llm-endpoints.js';
import { LlmError } from '../../llm.types.js';
import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmMessage,
  LlmToolCall,
} from '../../llm.types.js';

/** Per-endpoint cap for the OpenAI-compatible fallback list. */
export const OPENAI_CHAT_TIMEOUT_MS = 15_000;

export interface OpenAiCompatibleClientOptions {
  endpoint: ChatEndpointConfig;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class OpenAiCompatibleClient {
  constructor(private readonly options: OpenAiCompatibleClientOptions) {}

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const started = Date.now();
    const response = await this.send(
      chatCompletionsUrl(this.options.endpoint.url),
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.body(request)),
      },
    );
    const payload = (await readJson(response)) as OpenAiChatPayload;
    return fromOpenAiChat(
      payload,
      Date.now() - started,
      this.options.endpoint.model,
    );
  }

  async ping(): Promise<boolean> {
    const response = await this.send(modelsUrl(this.options.endpoint.url), {
      method: 'GET',
      headers: this.headers(),
    });
    return response.ok;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (this.options.endpoint.apiKey) {
      headers.authorization = `Bearer ${this.options.endpoint.apiKey}`;
    }
    return headers;
  }

  private body(request: LlmChatRequest): Record<string, unknown> {
    return {
      model: this.options.endpoint.model,
      messages: toOpenAiMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
      tools: request.tools?.length
        ? request.tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          }))
        : undefined,
    };
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? OPENAI_CHAT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchImpl = this.options.fetchImpl ?? fetch;
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await readError(response);
        const transient = response.status === 429 || response.status >= 500;
        throw new LlmError(message, 'runtime_unreachable', transient);
      }
      return response;
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if (isAbort(error)) {
        throw new LlmError('The model request timed out.', 'timeout', true);
      }
      throw new LlmError(
        error instanceof Error ? error.message : 'network error',
        'runtime_unreachable',
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function chatCompletionsUrl(base: string): string {
  const trimmed = base.replace(/\/$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function modelsUrl(base: string): string {
  const trimmed = base.replace(/\/$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.replace(/\/chat\/completions$/, '/models');
  }
  return `${trimmed}/models`;
}

function toOpenAiMessages(
  messages: LlmMessage[],
): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId || message.toolName || 'tool',
      };
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments ?? {}),
          },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

interface OpenAiChatPayload {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

function fromOpenAiChat(
  payload: OpenAiChatPayload,
  durationMs: number,
  fallbackModel: string,
): LlmChatResponse {
  if (payload.error?.message) {
    throw new LlmError(payload.error.message, 'runtime_unreachable', true);
  }
  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new LlmError(
      'The model returned an unreadable response.',
      'malformed',
    );
  }
  const toolCalls = (message.tool_calls ?? [])
    .map((call, index): LlmToolCall => ({
      id: call.id || `call_${index + 1}`,
      name: call.function?.name ?? '',
      arguments: readArguments(call.function?.arguments),
    }))
    .filter((call) => call.name.length > 0);
  return {
    message: {
      role: 'assistant',
      content:
        typeof message.content === 'string' ? message.content.trim() : '',
      toolCalls,
    },
    toolCalls,
    promptTokens: payload.usage?.prompt_tokens ?? null,
    completionTokens: payload.usage?.completion_tokens ?? null,
    durationMs,
    model: payload.model || fallbackModel,
  };
}

function readArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
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
    const body = (await response.json()) as {
      error?: { message?: string } | string;
    };
    if (typeof body.error === 'string') return body.error;
    return body.error?.message ?? response.statusText;
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
