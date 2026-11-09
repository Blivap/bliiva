export interface OllamaChatBody {
  model: string;
  messages: Array<Record<string, unknown>>;
  stream: boolean;
  tools?: Array<Record<string, unknown>>;
  format?: 'json';
  keep_alive?: string;
  options?: {
    temperature?: number;
    num_predict?: number;
    num_ctx?: number;
  };
}

export interface OllamaChatMessage {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    id?: string;
    function?: { name?: string; arguments?: unknown };
  }>;
  tool_name?: string;
}
