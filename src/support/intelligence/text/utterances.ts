export interface UtteranceSignals {
  greeting: boolean;
  closing: boolean;
  affirmation: boolean;
  /** Soft acknowledgement (ok / alright) — not a hard yes. */
  softAck: boolean;
  /** User telling the bot to perform the offered action. */
  actionGoAhead: boolean;
  negation: boolean;
  selection: boolean;
  ordinal: number | null;
  correction: boolean;
  correctionRemainder: string | null;
  /** Text after a leading hi/hello/hey when the rest is a real question. */
  greetingRemainder: string | null;
  botIdentityAsk: boolean;
  followUpFailure: boolean;
  frustrated: boolean;
}

const GREETING_ONLY =
  /^(hi|hello|hey|howdy|good morning|good afternoon|good evening|how are you|how are you doing|how is it going|hows it going|how s it going|what is up|whats up)( there)?$/;
const GREETING_PREFIX =
  /^(hi|hello|hey|howdy|good morning|good afternoon|good evening)( there)?(?:\s+|[,!.]+)+/;
/** Light presence / brand pings — reply like a greeting, not a hard redirect. */
const PRESENCE_CHECK =
  /^(?:(?:bliiva|blivap)\s+)?(?:are you there|you there|anybody there|anyone there|still there|you around|are you around|can you hear me)(?:\s+(?:bliiva|blivap))?$/;
const BRAND_PING = /^(bliiva|blivap)$/;
const CLOSING =
  /^(thanks|thank you|thank you very much|that is all|thats all|bye|goodbye|ok thanks|okay thanks|nothing|nothing more|nothing else|that will be all)$/;
const AFFIRMATION =
  /^(yes|yeah|yep|yup|correct|exactly|right)(?:\s+please)?$/;
const SOFT_ACK =
  /^(ok|okay|alright|all right|sure|got it|cool|great|sounds good|fine|perfect)(?:\s+please)?$/;
/** Imperative “do the thing” after the bot offered help or an action. */
const ACTION_GO_AHEAD =
  /^(?:(?:yes|yeah|yep|yup|ok|okay|sure|please)[, ]+)*(?:please[, ]+)?(?:do it|do that|do so|go ahead|go for it|please do|help me with that|help me do that|can you do it|could you do it|would you do it|show(?: me)?(?: it)?|check(?: it)?(?: now)?|resend(?: it)?|send(?: it)?(?: now)?|resend the (?:email|link|verification)|send the (?:email|link|verification))(?: please)?$/;
const NEGATION = /^(no|nope|nah)$/;
const SELECTION =
  /^(that one|this one|the first one|the second one|the third one)$/;
const BOT_IDENTITY =
  /^(your name|name\??)$|\b((what is|whats|who is) your name|who are you|what are you\b(?! called)|what are you called|what can you do|what do you do|how can you help|what do you help with|are you (an?|and)?\s*(ai|bot|robot|assistant|llm)|are you (real|human)|is this (an? )?(ai|bot))\b/;

const ORDINALS: Record<string, number> = {
  first: 0,
  'the first': 0,
  '1': 0,
  second: 1,
  'the second': 1,
  '2': 1,
  third: 2,
  'the third': 2,
  '3': 2,
};

const FRUSTRATION =
  /\b(useless|ridiculous|frustrated|frustrating|angry|worst|not helping|this is terrible)\b/;
const FOLLOW_UP_FAILURE =
  /\b(still (does not|doesnt|not) work|still cannot|did not help|didnt help|that did not help|same problem|not fixed|it still)\b/;

export function detectUtterance(normalized: string): UtteranceSignals {
  const text = normalized.trim();
  let correctionRemainder: string | null = null;
  const correctionMatch = text.match(
    /^(?:no[, ]+)?(?:i meant|i mean|actually|not that)[, ]*(.*)$/,
  );
  const correction = Boolean(correctionMatch);
  if (correctionMatch) {
    correctionRemainder = correctionMatch[1]?.trim() || null;
  }

  const botIdentityAsk = BOT_IDENTITY.test(text);
  const presenceCheck = PRESENCE_CHECK.test(text) || BRAND_PING.test(text);
  const prefixMatch = text.match(GREETING_PREFIX);
  const afterGreeting = prefixMatch
    ? text.slice(prefixMatch[0].length).trim()
    : '';
  const greetingOnly = GREETING_ONLY.test(text);
  const greetingWithChitchat =
    Boolean(prefixMatch) && (!afterGreeting || botIdentityAsk);
  const greetingRemainder =
    prefixMatch && afterGreeting && !botIdentityAsk ? afterGreeting : null;

  const actionGoAhead = ACTION_GO_AHEAD.test(text);
  const affirmation = AFFIRMATION.test(text);
  const softAck = !actionGoAhead && !affirmation && SOFT_ACK.test(text);

  return {
    // Identity / presence asks are answered by the greeting path.
    greeting:
      greetingOnly || greetingWithChitchat || botIdentityAsk || presenceCheck,
    closing: CLOSING.test(text),
    affirmation,
    softAck,
    actionGoAhead,
    negation: NEGATION.test(text),
    selection: SELECTION.test(text),
    ordinal: ORDINALS[text] ?? null,
    correction,
    correctionRemainder,
    greetingRemainder,
    botIdentityAsk,
    followUpFailure: FOLLOW_UP_FAILURE.test(text),
    frustrated: FRUSTRATION.test(text),
  };
}
