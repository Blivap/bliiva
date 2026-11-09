export interface MatchingWeights {
  exactPhrase: number;
  fuzzyPhrase: number;
  exactExample: number;
  keyword: number;
  synonym: number;
  fuzzyToken: number;
  contextBoost: number;
  priorityPerPoint: number;
  priorityCap: number;
}

export interface RetrievalWeights {
  intentMatch: number;
  categoryMatch: number;
  exactQuestion: number;
  fuzzyQuestion: number;
  keyword: number;
  synonym: number;
  priorityCap: number;
}

export interface IntelligenceSettings {
  autoHandleMinConfidence: number;
  clarificationMinConfidence: number;
  ambiguityMargin: number;
  minCandidateScore: number;
  alternativeMinScore: number;
  knowledgeMinScore: number;
  maxClarificationAttempts: number;
  maxRepeatedQuestions: number;
  cacheTtlMs: number;
  weights: MatchingWeights;
  retrieval: RetrievalWeights;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  exactPhrase: 0.88,
  fuzzyPhrase: 0.64,
  exactExample: 0.72,
  keyword: 0.22,
  synonym: 0.2,
  fuzzyToken: 0.16,
  contextBoost: 0.4,
  priorityPerPoint: 0.0004,
  priorityCap: 0.04,
};

export const DEFAULT_RETRIEVAL_WEIGHTS: RetrievalWeights = {
  intentMatch: 0.62,
  categoryMatch: 0.12,
  exactQuestion: 0.3,
  fuzzyQuestion: 0.18,
  keyword: 0.1,
  synonym: 0.08,
  priorityCap: 0.04,
};

const FALLBACK: IntelligenceSettings = {
  autoHandleMinConfidence: 0.85,
  clarificationMinConfidence: 0.6,
  ambiguityMargin: 0.08,
  minCandidateScore: 0.34,
  alternativeMinScore: 0.18,
  knowledgeMinScore: 0.55,
  maxClarificationAttempts: 2,
  maxRepeatedQuestions: 2,
  cacheTtlMs: 15000,
  weights: DEFAULT_MATCHING_WEIGHTS,
  retrieval: DEFAULT_RETRIEVAL_WEIGHTS,
};

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveIntelligenceSettings(
  input: Partial<Omit<IntelligenceSettings, 'weights' | 'retrieval'>> & {
    weights?: Partial<MatchingWeights>;
    retrieval?: Partial<RetrievalWeights>;
  } = {},
): IntelligenceSettings {
  let auto = clamp(
    numberOr(input.autoHandleMinConfidence, FALLBACK.autoHandleMinConfidence),
    0,
    1,
  );
  let clarification = clamp(
    numberOr(
      input.clarificationMinConfidence,
      FALLBACK.clarificationMinConfidence,
    ),
    0,
    1,
  );
  if (clarification >= auto) {
    auto = FALLBACK.autoHandleMinConfidence;
    clarification = FALLBACK.clarificationMinConfidence;
  }

  return {
    autoHandleMinConfidence: auto,
    clarificationMinConfidence: clarification,
    ambiguityMargin: clamp(
      numberOr(input.ambiguityMargin, FALLBACK.ambiguityMargin),
      0,
      0.5,
    ),
    minCandidateScore: clamp(
      numberOr(input.minCandidateScore, FALLBACK.minCandidateScore),
      0,
      1,
    ),
    alternativeMinScore: clamp(
      numberOr(input.alternativeMinScore, FALLBACK.alternativeMinScore),
      0,
      1,
    ),
    knowledgeMinScore: clamp(
      numberOr(input.knowledgeMinScore, FALLBACK.knowledgeMinScore),
      0,
      1,
    ),
    maxClarificationAttempts: Math.round(
      clamp(
        numberOr(
          input.maxClarificationAttempts,
          FALLBACK.maxClarificationAttempts,
        ),
        1,
        5,
      ),
    ),
    maxRepeatedQuestions: Math.round(
      clamp(
        numberOr(input.maxRepeatedQuestions, FALLBACK.maxRepeatedQuestions),
        1,
        5,
      ),
    ),
    cacheTtlMs: Math.round(
      clamp(numberOr(input.cacheTtlMs, FALLBACK.cacheTtlMs), 1000, 300000),
    ),
    weights: { ...DEFAULT_MATCHING_WEIGHTS, ...input.weights },
    retrieval: { ...DEFAULT_RETRIEVAL_WEIGHTS, ...input.retrieval },
  };
}
