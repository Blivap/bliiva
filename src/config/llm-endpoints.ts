export interface ChatEndpointConfig {
  url: string;
  apiKey: string;
  model: string;
}

const MAX_CHAT_ENDPOINTS = 8;

/**
 * Ordered OpenAI-compatible slots: LLM_URL_n / LLM_KEY_n / LLM_MODEL_n.
 * Incomplete slots are skipped. Ollama stays a separate optional provider.
 */
export function readChatEndpoints(
  env: NodeJS.ProcessEnv = process.env,
): ChatEndpointConfig[] {
  const endpoints: ChatEndpointConfig[] = [];
  for (let index = 1; index <= MAX_CHAT_ENDPOINTS; index += 1) {
    const url = env[`LLM_URL_${index}`]?.trim() ?? '';
    const model = env[`LLM_MODEL_${index}`]?.trim() ?? '';
    const apiKey = env[`LLM_KEY_${index}`]?.trim() ?? '';
    if (!url || !model) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    endpoints.push({
      url: url.replace(/\/$/, ''),
      apiKey,
      model,
    });
  }
  return endpoints;
}
