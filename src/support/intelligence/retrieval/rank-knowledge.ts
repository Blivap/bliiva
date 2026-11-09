import { KnowledgeStatus } from '../../../common/enums/index.js';
import type { IntelligenceSettings } from '../intelligence-settings.js';
import type {
  KnowledgeEntry,
  KnowledgeMatchResult,
  KnowledgeRanking,
} from '../interfaces/knowledge-match.interface.js';
import { matchPhrase } from '../text/fuzzy-matcher.js';
import { noisyOr } from '../text/score.js';
import { normalizeText } from '../text/text-normalizer.js';

export interface RankKnowledgeInput {
  text: string;
  entries: KnowledgeEntry[];
  intent: string | null;
  category: string | null;
  settings: IntelligenceSettings;
  preferredKnowledgeId?: string | null;
}

function lexicalScore(
  normalizedText: string,
  entry: KnowledgeEntry,
  settings: IntelligenceSettings,
): { weight: number; terms: string[] } {
  const terms: string[] = [];
  let bestQuestion = 0;
  let bestQuestionText: string | null = null;
  for (const question of [...entry.questions, ...entry.phrases]) {
    const match = matchPhrase(normalizedText, question);
    const weight =
      match === 'exact'
        ? settings.retrieval.exactQuestion
        : match === 'fuzzy'
          ? settings.retrieval.fuzzyQuestion
          : 0;
    if (weight > bestQuestion) {
      bestQuestion = weight;
      bestQuestionText = question;
    }
  }
  const parts: number[] = [];
  if (bestQuestion > 0 && bestQuestionText) {
    parts.push(bestQuestion);
    terms.push(bestQuestionText);
  }

  let keywords = 0;
  for (const keyword of entry.keywords) {
    if (keywords >= 4) break;
    if (matchPhrase(normalizedText, keyword) !== 'none') {
      parts.push(settings.retrieval.keyword);
      terms.push(keyword);
      keywords += 1;
    }
  }
  let synonyms = 0;
  for (const synonym of entry.synonyms) {
    if (synonyms >= 3) break;
    if (matchPhrase(normalizedText, synonym) !== 'none') {
      parts.push(settings.retrieval.synonym);
      terms.push(synonym);
      synonyms += 1;
    }
  }
  return { weight: parts.length ? noisyOr(parts) : 0, terms };
}

export function rankKnowledge(input: RankKnowledgeInput): KnowledgeRanking {
  const normalized = normalizeText(input.text);
  const published = input.entries.filter(
    (entry) => entry.status === KnowledgeStatus.Published,
  );
  const ranked: KnowledgeMatchResult[] = [];

  for (const entry of published) {
    const parts: number[] = [];
    const matchedTerms: string[] = [];
    const intentMatched = Boolean(
      input.intent && entry.intent === input.intent,
    );
    if (intentMatched) parts.push(input.settings.retrieval.intentMatch);
    if (input.category && entry.category === input.category) {
      parts.push(input.settings.retrieval.categoryMatch);
    }
    const lexical = lexicalScore(normalized, entry, input.settings);
    if (lexical.weight > 0) {
      parts.push(lexical.weight);
      matchedTerms.push(...lexical.terms);
    }
    if (entry.priority > 0) {
      parts.push(
        Math.min(input.settings.retrieval.priorityCap, entry.priority * 0.004),
      );
    }
    if (!intentMatched && input.intent && lexical.weight < 0.2) {
      continue;
    }
    let score = noisyOr(parts);
    if (
      input.preferredKnowledgeId &&
      entry.id === input.preferredKnowledgeId &&
      (!input.intent || entry.intent === input.intent)
    ) {
      score = Math.max(score, 0.93);
    }
    if (score < input.settings.alternativeMinScore) continue;
    ranked.push({
      knowledgeId: entry.id,
      title: entry.title,
      answer: entry.answer,
      score,
      matchedTerms,
      intent: entry.intent,
      category: entry.category,
      requiresAuthentication: entry.requiresAuthentication,
      requiresHumanSupport: entry.requiresHumanSupport,
      priority: entry.priority,
    });
  }

  ranked.sort((left, right) => {
    const difference = right.score - left.score;
    if (Math.abs(difference) > 0.03) return difference;
    return right.priority - left.priority;
  });

  const matches = ranked.slice(0, 5);
  const best = matches[0] ?? null;
  const second = matches[1];
  const usable =
    best && best.score >= input.settings.knowledgeMinScore ? best : null;
  const ambiguous = Boolean(
    usable &&
    second &&
    second.score >= input.settings.knowledgeMinScore &&
    usable.score - second.score < input.settings.ambiguityMargin &&
    second.knowledgeId !== usable.knowledgeId,
  );

  return {
    matches,
    best: ambiguous ? null : usable,
    ambiguous,
  };
}
