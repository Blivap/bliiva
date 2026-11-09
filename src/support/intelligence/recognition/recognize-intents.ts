import { IntentSensitivity } from '../../../common/enums/index.js';
import type { IntelligenceSettings } from '../intelligence-settings.js';
import {
  clarificationLabelOf,
  type IntentDefinition,
} from '../interfaces/intent-definition.interface.js';
import {
  policyRequiresHuman,
  type IntentRecognitionResult,
  type RecognitionContext,
} from '../interfaces/intent-recognizer.interface.js';
import { extractEntities } from '../text/entities.js';
import { matchPhrase, type PhraseMatch } from '../text/fuzzy-matcher.js';
import { noisyOr } from '../text/score.js';
import { normalizeText } from '../text/text-normalizer.js';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'i',
  'me',
  'my',
  'to',
  'and',
  'or',
  'of',
  'for',
  'in',
  'on',
  'is',
  'it',
  'this',
  'that',
  'with',
  'you',
  'your',
]);

interface ScoredIntent {
  definition: IntentDefinition;
  confidence: number;
  matchedKeywords: string[];
  matchedPhrases: string[];
}

function bestPhraseContribution(
  normalizedText: string,
  phrases: string[],
  exactWeight: number,
  fuzzyWeight: number,
): { weight: number; phrase: string | null; mode: PhraseMatch } {
  let weight = 0;
  let phrase: string | null = null;
  let mode: PhraseMatch = 'none';
  for (const candidate of phrases) {
    const match = matchPhrase(normalizedText, candidate);
    const candidateWeight =
      match === 'exact' ? exactWeight : match === 'fuzzy' ? fuzzyWeight : 0;
    if (candidateWeight > weight) {
      weight = candidateWeight;
      phrase = candidate;
      mode = match;
    }
  }
  return { weight, phrase, mode };
}

function scoreIntent(
  normalizedText: string,
  intent: IntentDefinition,
  settings: IntelligenceSettings,
  context: RecognitionContext | undefined,
): ScoredIntent | null {
  if (
    intent.negativeKeywords.some(
      (term) => matchPhrase(normalizedText, term) === 'exact',
    )
  ) {
    return null;
  }

  const parts: number[] = [];
  const matchedKeywords: string[] = [];
  const matchedPhrases: string[] = [];

  const phrase = bestPhraseContribution(
    normalizedText,
    intent.phrases,
    settings.weights.exactPhrase,
    settings.weights.fuzzyPhrase,
  );
  const example = bestPhraseContribution(
    normalizedText,
    intent.examples,
    settings.weights.exactExample,
    settings.weights.fuzzyPhrase,
  );
  if (example.weight > phrase.weight && example.phrase) {
    parts.push(example.weight);
    matchedPhrases.push(example.phrase);
  } else if (phrase.weight > 0 && phrase.phrase) {
    parts.push(phrase.weight);
    matchedPhrases.push(phrase.phrase);
  }

  let keywordHits = 0;
  for (const keyword of intent.keywords) {
    if (keywordHits >= 4) break;
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword || STOPWORDS.has(normalizedKeyword)) continue;
    const match = matchPhrase(normalizedText, keyword);
    if (match === 'exact') {
      parts.push(settings.weights.keyword);
      matchedKeywords.push(keyword);
      keywordHits += 1;
    } else if (match === 'fuzzy') {
      parts.push(settings.weights.fuzzyToken);
      matchedKeywords.push(keyword);
      keywordHits += 1;
    }
  }

  let synonymHits = 0;
  for (const synonym of intent.synonyms) {
    if (synonymHits >= 3) break;
    const normalizedSynonym = normalizeText(synonym);
    if (!normalizedSynonym || matchedKeywords.includes(synonym)) continue;
    const match = matchPhrase(normalizedText, synonym);
    if (match === 'exact') {
      parts.push(settings.weights.synonym);
      matchedKeywords.push(synonym);
      synonymHits += 1;
    } else if (match === 'fuzzy') {
      parts.push(settings.weights.fuzzyToken);
      matchedKeywords.push(synonym);
      synonymHits += 1;
    }
  }

  const lexical = parts.length > 0;
  const contextMatch =
    !context?.correction &&
    context?.currentIntent === intent.name &&
    (lexical || context.followUpCue);
  if (contextMatch) parts.push(settings.weights.contextBoost);
  if (intent.priority > 0) {
    parts.push(
      Math.min(
        settings.weights.priorityCap,
        intent.priority * settings.weights.priorityPerPoint,
      ),
    );
  }

  if (parts.length === 0) return null;
  return {
    definition: intent,
    confidence: noisyOr(parts),
    matchedKeywords,
    matchedPhrases,
  };
}

function emptyResult(text: string): IntentRecognitionResult {
  return {
    intent: null,
    category: null,
    confidence: 0,
    matchedKeywords: [],
    matchedPhrases: [],
    alternatives: [],
    requiresClarification: true,
    requiresAuthentication: false,
    requiresHumanSupport: false,
    entities: extractEntities(text),
    sensitivity: null,
    escalationPolicy: null,
    priority: 0,
  };
}

export function recognizeIntents(
  text: string,
  intents: IntentDefinition[],
  settings: IntelligenceSettings,
  context?: RecognitionContext,
): IntentRecognitionResult {
  const normalized = normalizeText(text);
  if (!normalized) return emptyResult(text);
  const scored = intents
    .filter((intent) => intent.enabled)
    .map((intent) => scoreIntent(normalized, intent, settings, context))
    .filter((item): item is ScoredIntent => item !== null)
    .sort((left, right) => {
      const difference = right.confidence - left.confidence;
      if (Math.abs(difference) > 0.03) return difference;
      return right.definition.priority - left.definition.priority;
    });

  const viable = scored.filter(
    (item) => item.confidence >= settings.alternativeMinScore,
  );
  const best = viable[0];
  if (!best || best.confidence < settings.minCandidateScore) {
    return {
      ...emptyResult(text),
      confidence: best?.confidence ?? 0,
      alternatives: viable.slice(0, 3).map((item) => ({
        intent: item.definition.name,
        confidence: item.confidence,
        category: item.definition.category,
      })),
    };
  }

  const second = viable[1];
  const ambiguous = Boolean(
    second && best.confidence - second.confidence < settings.ambiguityMargin,
  );
  const autoBar = Math.max(
    settings.autoHandleMinConfidence,
    best.definition.confidenceThreshold ?? 0,
  );
  const requiresClarification = ambiguous || best.confidence < autoBar;

  return {
    intent: best.definition.name,
    category: best.definition.category,
    confidence: best.confidence,
    matchedKeywords: best.matchedKeywords,
    matchedPhrases: best.matchedPhrases,
    alternatives: viable.slice(1, 4).map((item) => ({
      intent: item.definition.name,
      confidence: item.confidence,
      category: item.definition.category,
    })),
    requiresClarification,
    requiresAuthentication: best.definition.requiresAuthentication,
    requiresHumanSupport: policyRequiresHuman(best.definition.escalationPolicy),
    entities: extractEntities(text),
    sensitivity: best.definition.sensitivity ?? IntentSensitivity.Low,
    escalationPolicy: best.definition.escalationPolicy,
    priority: best.definition.priority,
  };
}

export function labelFor(intents: IntentDefinition[], name: string): string {
  const found = intents.find((intent) => intent.name === name);
  return found
    ? clarificationLabelOf(found)
    : name.toLowerCase().replace(/_/g, ' ');
}
