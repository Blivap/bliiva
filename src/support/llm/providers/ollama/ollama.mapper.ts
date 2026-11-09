import { LlmError } from '../../llm.types.js';
import type {
  LlmChatResponse,
  LlmMessage,
  LlmStreamChunk,
  LlmToolCall,
  LlmToolDefinition,
} from '../../llm.types.js';
import type { OllamaChatMessage } from './ollama.types.js';

export function toOllamaMessages(
  messages: LlmMessage[],
): Array<Record<string, unknown>> {
  return messages.map((message) => {
    const payload: Record<string, unknown> = {
      role: message.role,
      content: message.content,
    };
    if (message.toolName) payload.tool_name = message.toolName;
    if (message.toolCalls?.length) {
      payload.tool_calls = message.toolCalls.map((call) => ({
        id: call.id,
        function: { name: call.name, arguments: call.arguments },
      }));
    }
    return payload;
  });
}

export function toOllamaTools(
  tools: LlmToolDefinition[],
): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function fromOllamaMessage(message: OllamaChatMessage): {
  content: string;
  toolCalls: LlmToolCall[];
} {
  const toolCalls = (message.tool_calls ?? []).map((call, index) => ({
    id: call.id ?? `call_${index + 1}`,
    name: call.function?.name ?? '',
    arguments: readArguments(call.function?.arguments),
  }));
  const content =
    typeof message.content === 'string' ? message.content.trim() : '';
  const thinking =
    typeof message.thinking === 'string' ? message.thinking.trim() : '';
  return {
    // Some thinking models leave content empty and put the reply in thinking.
    content: content || thinking,
    toolCalls: toolCalls.filter((call) => call.name),
  };
}

export function fromOllamaChatResponse(
  body: unknown,
  durationMs: number,
  fallbackModel: string,
): LlmChatResponse {
  if (!body || typeof body !== 'object') {
    throw new LlmError(
      'The model returned an unreadable response.',
      'malformed',
    );
  }
  const record = body as {
    model?: string;
    message?: OllamaChatMessage;
    prompt_eval_count?: number;
    eval_count?: number;
    error?: string;
  };
  if (record.error) {
    throw mapOllamaError(record.error, 500);
  }
  if (!record.message || typeof record.message !== 'object') {
    throw new LlmError(
      'The model response did not include a message.',
      'malformed',
    );
  }
  const parsed = fromOllamaMessage(record.message);
  if (!parsed.content.trim() && parsed.toolCalls.length === 0) {
    throw new LlmError(
      'The model returned an empty response.',
      'empty_response',
    );
  }
  return {
    message: {
      role: 'assistant',
      content: parsed.content,
      toolCalls: parsed.toolCalls,
    },
    toolCalls: parsed.toolCalls,
    promptTokens:
      typeof record.prompt_eval_count === 'number'
        ? record.prompt_eval_count
        : null,
    completionTokens:
      typeof record.eval_count === 'number' ? record.eval_count : null,
    durationMs,
    model: record.model || fallbackModel,
  };
}

export function fromOllamaStreamLine(line: string): LlmStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw new LlmError('The model stream was not valid JSON.', 'malformed');
  }
  if (!body || typeof body !== 'object') return null;
  const record = body as {
    message?: OllamaChatMessage;
    done?: boolean;
    error?: string;
  };
  if (record.error) throw mapOllamaError(record.error, 500);
  const parsed = record.message ? fromOllamaMessage(record.message) : null;
  return {
    content: parsed?.content ?? '',
    done: record.done === true,
    toolCalls: parsed?.toolCalls,
  };
}

export function mapOllamaError(message: string, status: number): LlmError {
  const loading = /loading model|llm server loading|timed out waiting/i.test(
    message,
  );
  if (loading || status === 503) {
    return new LlmError(message, 'model_loading', true);
  }
  if (status === 404 || /not found/i.test(message)) {
    return new LlmError(message, 'model_unavailable');
  }
  if (status >= 500) {
    return new LlmError(message, 'runtime_error', true);
  }
  return new LlmError(message, 'runtime_error');
}

function readArguments(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new LlmError('A tool call had unreadable arguments.', 'malformed');
    }
  }
  throw new LlmError('A tool call had unreadable arguments.', 'malformed');
}
