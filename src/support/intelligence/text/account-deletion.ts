import { IntentSensitivity } from '../../../common/enums/index.js';
import { EscalationPolicy } from '../interfaces/intent-recognizer.interface.js';
import type { IntentRecognitionResult } from '../interfaces/intent-recognizer.interface.js';
import { extractEntities } from './entities.js';

/**
 * Account closure is a formal request. Chat has no delete-account tool, so
 * these phrases stay on the rules path and open a ticket.
 */
const ACCOUNT_DELETION =
  /\b(?:delete|close|remove|erase|deactivate|cancel)\s+(?:my\s+|the\s+|this\s+)?(?:blivap\s+|bliiva\s+)?account\b|\b(?:delete|remove|erase)\s+(?:my\s+|all\s+my\s+|the\s+)?(?:personal\s+)?data\b|\b(?:leave|quit)\s+(?:blivap|bliiva)\b|\bdo not want to be (?:a )?part of (?:blivap|bliiva)\b|\bunsubscribe\b/;

export function isAccountDeletionRequest(normalized: string): boolean {
  return ACCOUNT_DELETION.test(normalized);
}

export function accountDeletionRecognition(
  text: string,
): IntentRecognitionResult {
  return {
    intent: 'ACCOUNT_DELETION',
    category: 'privacy_security',
    confidence: 0.99,
    matchedKeywords: [],
    matchedPhrases: ['delete account'],
    alternatives: [],
    requiresClarification: false,
    requiresAuthentication: false,
    requiresHumanSupport: true,
    entities: extractEntities(text),
    sensitivity: IntentSensitivity.High,
    escalationPolicy: EscalationPolicy.EscalateImmediately,
    priority: 160,
  };
}
