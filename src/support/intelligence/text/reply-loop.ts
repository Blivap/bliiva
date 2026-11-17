/** Ignore fixed, honest replies so a greeting or a real handoff is not a loop. */
const BENIGN_REPEAT = [
  /official ai support/,
  /^hi\b/,
  /you re welcome/,
  /yes to what/,
  /no to what/,
  /here if you need/,
  /what would you like help with today/,
  /what would you like to do next/,
  /what else should we look at/,
  /take care/,
  /got it/,
  /i won t escalate/,
  /i won t look that up/,
  /nothing changed/,
  /specialist is on this chat/,
  /this chat is closed/,
  /can t delete accounts from chat/,
  /i can help with blivap accounts/,
];

export function canonReply(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function repliesNearlyIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = canonReply(left);
  const b = canonReply(right);
  if (!a || !b || a.length < 12 || b.length < 12) return false;
  if (a === b) return true;
  const aTokens = new Set(a.split(' '));
  const bTokens = new Set(b.split(' '));
  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared += 1;
  }
  const union = aTokens.size + bTokens.size - shared;
  return union > 0 && shared / union >= 0.9;
}

/** True when the last two bot replies are the same unhelpful text. */
export function isUnhelpfulLoop(
  previous: string | null | undefined,
  last: string | null | undefined,
): boolean {
  if (!repliesNearlyIdentical(previous, last)) return false;
  const text = canonReply(last);
  return !BENIGN_REPEAT.some((pattern) => pattern.test(text));
}
