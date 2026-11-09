export interface OllamaChatBody {
  model: string;
  messages: Array<Record<string, unknown>>;
  stream: boolean;
  tools?: Array<Record<string, unknown>>;
  format?: 'json';
  keep_alive?: string;
  /** Qwen3+ put answers in thinking unless this is false. */
  think?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    num_ctx?: number;
  };
}

export interface OllamaChatMessage {
  role?: string;
  content?: string;
  thinking?: string;
  tool_calls?: Array<{
    id?: string;
    function?: { name?: string; arguments?: unknown };
  }>;
  tool_name?: string;
}
