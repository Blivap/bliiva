import type { RetrievedChunk } from '../rag.types.js';

const STOP = new Set([
  'a',
  'an',
  'the',
  'to',
  'do',
  'i',
  'my',
  'is',
  'of',
  'for',
  'and',
  'how',
  'what',
  'when',
  'why',
  'can',
  'you',
  'me',
  'please',
]);

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

export function keywordScore(query: string, text: string): number {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return 0;
  const haystack = new Set(tokenize(text));
  const hits = terms.filter((term) => haystack.has(term)).length;
  return hits / terms.length;
}

export function hybridRank(input: {
  semantic: RetrievedChunk[];
  keyword: RetrievedChunk[];
  semanticWeight: number;
  topK: number;
  minScore: number;
}): RetrievedChunk[] {
  const weight = clamp(input.semanticWeight, 0, 1);
  const merged = new Map<
    string,
    RetrievedChunk & { semanticScore: number; keywordScore: number }
  >();
  for (const chunk of input.semantic) {
    merged.set(chunkKey(chunk), {
      ...chunk,
      semanticScore: clamp(chunk.score, 0, 1),
      keywordScore: 0,
      score: 0,
    });
  }
  for (const chunk of input.keyword) {
    const key = chunkKey(chunk);
    const existing = merged.get(key);
    const keyword = clamp(chunk.score, 0, 1);
    if (existing) {
      existing.keywordScore = keyword;
    } else {
      merged.set(key, {
        ...chunk,
        semanticScore: 0,
        keywordScore: keyword,
        score: 0,
      });
    }
  }
  return [...merged.values()]
    .map((chunk) => ({
      ...chunk,
      score: chunk.semanticScore * weight + chunk.keywordScore * (1 - weight),
    }))
    .filter(
      (chunk) =>
        chunk.score >= input.minScore ||
        chunk.semanticScore >= input.minScore ||
        chunk.keywordScore >= input.minScore,
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, input.topK)
    .map(
      ({ semanticScore: _semantic, keywordScore: _keyword, ...chunk }) => chunk,
    );
}

export function sharesGrounding(answer: string, sources: string[]): boolean {
  const answerTokens = new Set(tokenize(answer));
  if (answerTokens.size === 0) return false;
  const sourceTokens = new Set(tokenize(sources.join(' ')));
  let hits = 0;
  for (const token of answerTokens) {
    if (sourceTokens.has(token)) hits += 1;
  }
  return hits / answerTokens.size >= 0.2;
}

function chunkKey(chunk: RetrievedChunk): string {
  return `${chunk.documentId}:${chunk.chunkIndex}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
