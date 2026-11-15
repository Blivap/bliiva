/**
 * Strip model thinking / planning so only a customer-facing reply can ship.
 * Thinking must never become the user-visible response.
 */

const THINK_BLOCK = /<think>[\s\S]*?<\/think>/gi;
const THINK_TAG = /<\/?think>/gi;
const SECRET_INLINE =
  /\b(password|otp|access token)\s*[:=]\s*\S+/gi;

const A = `['’]`; // ASCII or curly apostrophe

/** Markers that mean the model is narrating its process, not talking to the user. */
const REASONING_MARKERS: RegExp[] = [
  new RegExp(`\\bokay,? let${A}?s (start|begin|see|go|try|understand)\\b`, 'i'),
  new RegExp(
    `\\balright,? let${A}?s (start|begin|see|go|try|understand)\\b`,
    'i',
  ),
  new RegExp(
    `\\b(let${A}?s|let us) (start by|begin by) (understanding|looking|checking)\\b`,
    'i',
  ),
  /\bunderstanding what the (user|customer)\b/i,
  /\bthe (user|customer) (sent|said|asked|is asking)\b/i,
  new RegExp(`\\bthey said,?\\s*["“']`, 'i'),
  /\bsince the (user|customer)\b/i,
  new RegExp(
    `\\bi(${A}ll| will) (generate|take it|keep it|ensure|also ensure|make sure|assume|reply|respond|acknowledge)\\b`,
    'i',
  ),
  /\bi (should|need to) (check|reply|respond|call|see|acknowledge|inform|generate|understand)\b/i,
  /\blet me (call|check|see|reply|start|begin|understand)\b/i,
  /\bthe final reply (will|is)\b/i,
  /\bin line with the (tone|style|instructions|prompt)\b/i,
  /\b(warm,? calm|plain language tone|knowledge notes|chain[- ]of[- ]thought)\b/i,
  /\b(looking at the tools|available tools|tools provided|tool-choice)\b/i,
  new RegExp(`\\bthere(${A}s| is) a function\\b`, 'i'),
  /\bno tools? (are |is )?needed\b/i,
  /\bfirst,? i (should|need to)\b/i,
  /\binvite them to ask\b/i,
  /\bnot explicitly listed\b/i,
  /\bavoid(?:ing)? any (unnecessary|technical)\b/i,
  new RegExp(
    `\\bi(${A}ll| will) (also )?ensure that the response\\b`,
    'i',
  ),
  /\bthis is a bit vague\b/i,
  /\btake it as a request\b/i,
  /\breasoning:|planning:|internal (monologue|thought)\b/i,
];

export function sanitizeAnswer(value: string, userMessage?: string): string {
  let cleaned = value
    .replace(THINK_BLOCK, '')
    .replace(THINK_TAG, '')
    .replace(SECRET_INLINE, '$1: [redacted]')
    .trim();

  if (!cleaned) return '';

  if (looksLikeLeakedReasoning(cleaned)) {
    cleaned = stripLeakedReasoning(cleaned);
  }

  // Dense planning that survived paragraph filters — drop entirely.
  if (cleaned && looksLikeLeakedReasoning(cleaned)) {
    return '';
  }

  if (userMessage && cleaned && isEchoOfUser(userMessage, cleaned)) {
    return '';
  }

  return cleaned.slice(0, 4000);
}

export function looksLikeLeakedReasoning(value: string): boolean {
  const text = value.trim();
  if (!text) return false;

  if (REASONING_MARKERS.some((marker) => marker.test(text))) {
    return true;
  }

  // Third-person analysis of “the customer/user” + planning voice.
  const talksAboutCustomer =
    /\b(the customer|the user|what the customer|what the user)\b/i.test(text);
  const planningVoice = new RegExp(
    `\\b(i(${A}ll| will)|let me|i need to|i should|so,? the final)\\b`,
    'i',
  ).test(text);
  return talksAboutCustomer && planningVoice;
}

export function stripLeakedReasoning(value: string): string {
  const parts = value
    .split(/\n{2,}|\n(?=[A-Z])|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);

  const kept = parts.filter((part) => !looksLikeLeakedReasoning(part));
  if (kept.length === 0) return '';

  const joined = kept.join('\n\n').trim();
  // If most of the original was planning, don’t ship a leftover fragment.
  if (joined.length < value.trim().length * 0.25 && parts.length >= 3) {
    return '';
  }
  return joined;
}

export function isEchoOfUser(userMessage: string, answer: string): boolean {
  const user = normalizeComparable(userMessage);
  if (!user) return false;

  const candidates = [
    answer,
    answer.split(/\n+/)[0] ?? answer,
    answer.split(/(?<=[.!?])\s+/)[0] ?? answer,
  ];

  for (const candidate of candidates) {
    const bot = normalizeComparable(candidate);
    if (!bot) continue;
    if (bot === user) return true;
    // Echo + short filler (“Why do you…? I’m here to help!”).
    if (bot.startsWith(user) && bot.length <= user.length + 80) {
      const rest = bot.slice(user.length).trim();
      if (
        !rest ||
        /^(i m here|i am here|let me know|how can i (help|assist))/i.test(rest)
      ) {
        return true;
      }
    }
  }
  return false;
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(i['’]m)\b/g, 'i am')
    .replace(/\b(don['’]t)\b/g, 'do not')
    .replace(/\b(can['’]t)\b/g, 'cannot')
    .replace(/\b(what['’]s)\b/g, 'what is')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
