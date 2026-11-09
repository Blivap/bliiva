import { normalizeText, tokenize } from './text-normalizer.js';

export function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      const insert = (current[j - 1] ?? 0) + 1;
      const remove = (previous[j] ?? 0) + 1;
      const replace = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(insert, remove, replace);
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

export function tokensSimilar(left: string, right: string): boolean {
  if (left === right) return true;
  const max = Math.max(left.length, right.length);
  const min = Math.min(left.length, right.length);
  if (min < 4) return false;
  const distanceLimit = max >= 8 ? 2 : 1;
  if (max - min > distanceLimit) return false;
  return levenshtein(left, right) <= distanceLimit;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type PhraseMatch = 'exact' | 'fuzzy' | 'none';

export function matchPhrase(
  normalizedText: string,
  phrase: string,
): PhraseMatch {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return 'none';
  const tokens = tokenize(normalizedText);
  const phraseTokens = tokenize(normalizedPhrase);
  if (phraseTokens.length === 0) return 'none';

  const bounded = new RegExp(
    `(?:^|\\s)${escapeRegExp(normalizedPhrase)}(?:\\s|$)`,
  );
  if (bounded.test(normalizedText)) return 'exact';

  if (phraseTokens.length === 1) {
    return tokens.some((token) => tokensSimilar(token, phraseTokens[0]))
      ? 'fuzzy'
      : 'none';
  }

  const width = phraseTokens.length;
  for (let index = 0; index <= tokens.length - width; index += 1) {
    let matched = true;
    let usedFuzzy = false;
    for (let offset = 0; offset < width; offset += 1) {
      const token = tokens[index + offset] ?? '';
      const expected = phraseTokens[offset] ?? '';
      if (token === expected) continue;
      if (tokensSimilar(token, expected)) {
        usedFuzzy = true;
        continue;
      }
      matched = false;
      break;
    }
    if (matched) return usedFuzzy ? 'fuzzy' : 'exact';
  }
  return 'none';
}

export function hasTerm(
  normalizedText: string,
  tokens: string[],
  term: string,
): boolean {
  return matchPhrase(normalizedText, term) === 'exact';
}
