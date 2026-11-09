export interface UtteranceSignals {
  greeting: boolean;
  closing: boolean;
  affirmation: boolean;
  negation: boolean;
  selection: boolean;
  ordinal: number | null;
  correction: boolean;
  correctionRemainder: string | null;
  followUpFailure: boolean;
  frustrated: boolean;
}

const GREETING =
  /^(hi|hello|hey|howdy|good morning|good afternoon|good evening|how are you|how are you doing|how is it going|hows it going|how s it going|what is up|whats up)( there)?$/;
const CLOSING =
  /^(thanks|thank you|thank you very much|that is all|thats all|bye|goodbye|ok thanks|okay thanks)$/;
const AFFIRMATION = /^(yes|yeah|yep|yup|correct|exactly|right)$/;
const NEGATION = /^(no|nope|nah)$/;
const SELECTION =
  /^(that one|this one|the first one|the second one|the third one)$/;

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

  return {
    greeting: GREETING.test(text),
    closing: CLOSING.test(text),
    affirmation: AFFIRMATION.test(text),
    negation: NEGATION.test(text),
    selection: SELECTION.test(text),
    ordinal: ORDINALS[text] ?? null,
    correction,
    correctionRemainder,
    followUpFailure: FOLLOW_UP_FAILURE.test(text),
    frustrated: FRUSTRATION.test(text),
  };
}
