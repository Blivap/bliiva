import type { LlmChatRequest } from './llm.types.js';

const SECRET_KEY =
  /password|otp|pin|token|secret|authorization|nin|bvn|accesskey|refreshtoken|accountnumber|account_number|nuban|sortcode/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{4,}\b/g;
const BEARER = /\b(bearer\s+)[a-z0-9\-._~+/=]+/gi;
const LABELED_SECRET =
  /\b(password|otp|one[- ]time code|pin|nin|bvn|access token|account number|bank account)\b\s*(?:is|[:=])\s*\S+/gi;
const BARE_OTP = /\b(?:otp|code)\b.{0,12}\b([A-Za-z0-9]{6})\b/gi;
const NIN = /\b\d{11}\b/g;
const BANK_ACCOUNT = /\b\d{10}\b/g;

/** Strip secrets from text that will be sent to a model. Does not truncate. */
export function redactSecrets(text: string): string {
  return text
    .replace(BEARER, '$1[redacted]')
    .replace(JWT, '[redacted-token]')
    .replace(EMAIL, '[redacted-email]')
    .replace(LABELED_SECRET, '$1: [redacted]')
    .replace(BARE_OTP, 'otp: [redacted]')
    .replace(NIN, '[redacted-nin]')
    .replace(BANK_ACCOUNT, '[redacted-account]');
}

export function redactForPrompt(text: string): string {
  return redactSecrets(text).slice(0, 2000);
}

export function redactChatRequest(request: LlmChatRequest): LlmChatRequest {
  return {
    ...request,
    messages: request.messages.map((message) => ({
      ...message,
      content: redactSecrets(message.content),
      toolCalls: message.toolCalls?.map((call) => ({
        ...call,
        arguments: (sanitizeForModel(call.arguments) ?? {}) as Record<
          string,
          unknown
        >,
      })),
    })),
  };
}

export function sanitizeForModel(value: unknown, depth = 0): unknown {
  if (depth > 6) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForModel(item, depth + 1));
  }
  if (typeof value === 'string') return redactSecrets(value);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    output[key] = sanitizeForModel(entry, depth + 1);
  }
  return output;
}

export function detectPromptInjection(text: string): boolean {
  return /ignore (all |any |previous |prior )?(instructions|rules)|system prompt|developer message|jailbreak|reveal your (instructions|prompt)|you are now|act as (dan|a developer)/i.test(
    text,
  );
}

export function detectArbitraryExecution(text: string): boolean {
  return /\b(drop table|rm -rf|execute javascript|run this sql|<script)\b/i.test(
    text,
  );
}

export function expressesUncertainty(text: string): boolean {
  return /\b(do not have|don't have|cannot find|can't find|not sure|do not know|don't know|approved article|no approved)\b/i.test(
    text,
  );
}

export function claimsUnconfirmedChange(text: string): boolean {
  return /\b(i (have|just) (cancelled|canceled|updated|approved|transferred)|has been (cancelled|canceled|transferred|approved))\b/i.test(
    text,
  );
}
