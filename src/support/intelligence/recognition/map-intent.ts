import { IntentSensitivity } from '../../../common/enums/index.js';
import {
  humanizeIntent,
  type IntentDefinition,
} from '../interfaces/intent-definition.interface.js';

export interface IntentRecord {
  name: string;
  description: string;
  category: string;
  keywords?: string[];
  phrases?: string[];
  synonyms?: string[];
  examples?: string[];
  negativeKeywords?: string[];
  priority?: number;
  confidenceThreshold?: number | null;
  enabled?: boolean;
  sensitivity?: IntentSensitivity;
  requiresAuthentication?: boolean;
  escalationPolicy?: string;
  clarificationLabel?: string;
}

export function toIntentDefinition(record: IntentRecord): IntentDefinition {
  return {
    name: record.name,
    description: record.description,
    category: record.category,
    keywords: record.keywords ?? [],
    phrases: record.phrases ?? [],
    synonyms: record.synonyms ?? [],
    examples: record.examples ?? [],
    negativeKeywords: record.negativeKeywords ?? [],
    priority: record.priority ?? 0,
    confidenceThreshold: record.confidenceThreshold ?? null,
    enabled: record.enabled !== false,
    sensitivity: record.sensitivity ?? IntentSensitivity.Low,
    requiresAuthentication: record.requiresAuthentication === true,
    escalationPolicy: record.escalationPolicy ?? 'answer_from_knowledge',
    clarificationLabel:
      record.clarificationLabel?.trim() || humanizeIntent(record.name),
  };
}
