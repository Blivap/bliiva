import type { IntentSensitivity } from '../../../common/enums/index.js';

export interface IntentAlternative {
  intent: string;
  confidence: number;
  category: string;
}

/**
 * Explainable recognition result.
 * `confidence` is a weighted matching score in the range 0–1, not a probability.
 * `intent` stays null when the message does not contain enough evidence.
 */
export interface IntentRecognitionResult {
  intent: string | null;
  category: string | null;
  confidence: number;
  matchedKeywords: string[];
  matchedPhrases: string[];
  alternatives: IntentAlternative[];
  requiresClarification: boolean;
  requiresAuthentication: boolean;
  requiresHumanSupport: boolean;
  entities: Record<string, string>;
  sensitivity: IntentSensitivity | null;
  escalationPolicy: string | null;
  priority: number;
}

export interface RecognitionContext {
  currentIntent?: string | null;
  correction?: boolean;
  followUpCue?: boolean;
}

/**
 * Replaceable intent recognition contract.
 * Phase 2: RuleBasedRecognizerService.
 * A later NLP or local model can implement this without changing the orchestrator.
 */
export interface IntentRecognizer {
  recognize(
    text: string,
    context?: RecognitionContext,
  ): Promise<IntentRecognitionResult>;
}

export const INTENT_RECOGNIZER = Symbol('INTENT_RECOGNIZER');

export const EscalationPolicy = {
  AnswerFromKnowledge: 'answer_from_knowledge',
  ActionThenClarify: 'action_then_clarify',
  ClarifyThenEscalate: 'clarify_then_escalate',
  EscalateImmediately: 'escalate_immediately',
  Emergency: 'emergency_guidance_and_escalate',
} as const;

export function policyRequiresHuman(
  policy: string | null | undefined,
): boolean {
  return (
    policy === EscalationPolicy.EscalateImmediately ||
    policy === EscalationPolicy.Emergency
  );
}
