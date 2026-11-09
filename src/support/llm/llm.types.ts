export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: 'string'; description: string }>;
    required: string[];
  };
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: LlmToolCall[];
  toolName?: string;
}

export interface LlmChatRequest {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  format?: 'json';
}

export interface LlmChatResponse {
  message: LlmMessage;
  toolCalls: LlmToolCall[];
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
  model: string;
}

export interface LlmStreamChunk {
  content: string;
  done: boolean;
  toolCalls?: LlmToolCall[];
}

export interface LlmHealth {
  ok: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  runtimeReachable: boolean;
  modelAvailable: boolean;
  message: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly transient = false,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
