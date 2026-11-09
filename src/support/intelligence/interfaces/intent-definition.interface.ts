import type { IntentSensitivity } from '../../../common/enums/index.js';

export interface IntentDefinition {
  name: string;
  description: string;
  category: string;
  keywords: string[];
  phrases: string[];
  synonyms: string[];
  examples: string[];
  negativeKeywords: string[];
  priority: number;
  confidenceThreshold: number | null;
  enabled: boolean;
  sensitivity: IntentSensitivity;
  requiresAuthentication: boolean;
  escalationPolicy: string;
  clarificationLabel: string;
}

export function humanizeIntent(name: string): string {
  return name.toLowerCase().replace(/_/g, ' ');
}

export function clarificationLabelOf(intent: IntentDefinition): string {
  const label = intent.clarificationLabel.trim();
  return label || humanizeIntent(intent.name);
}
