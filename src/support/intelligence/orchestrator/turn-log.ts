import { redactForAnalytics } from '../../analytics/redaction.js';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s()-]{7,}\d/g;
const LABELED_SECRET =
  /\b(password|otp|one[- ]time code|pin|nin|bvn|access token|account number|bank account)\b\s*(?:is|[:=])\s*\S+/gi;

export interface TurnLogInput {
  conversationId: string;
  userText: string;
  reply: string;
  responseType: string;
  reason: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  model?: string | null;
  source: string;
  latencyMs: number;
  safetyRedact?: boolean;
}

export interface TurnLogRecord {
  event: 'support.turn';
  conversationId: string;
  user: string | null;
  reply: string | null;
  responseType: string;
  reason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  model: string | null;
  source: string;
  latencyMs: number;
}

/** One redacted line per chat turn, including why a reply failed. */
export function buildTurnLog(input: TurnLogInput): TurnLogRecord {
  return {
    event: 'support.turn',
    conversationId: input.conversationId,
    user: excerpt(input.userText, input.safetyRedact),
    reply: excerpt(input.reply, input.safetyRedact),
    responseType: input.responseType,
    reason: input.reason,
    errorCode: input.errorCode ?? null,
    errorMessage: excerpt(input.errorMessage ?? '', input.safetyRedact),
    model: input.model ?? null,
    source: input.source,
    latencyMs: input.latencyMs,
  };
}

export function asMetaString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function excerpt(text: string, forceRedact = false): string | null {
  if (!text.trim() || forceRedact) return null;
  // Null means the analytics redactor withheld the text (medical). Keep that.
  if (redactForAnalytics(text) === null) return null;
  const cleaned = text
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(LABELED_SECRET, '$1: [redacted]')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 180);
}
