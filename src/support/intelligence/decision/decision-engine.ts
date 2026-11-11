import {
  OrchestratorResponseType,
  Priority,
} from '../../../common/enums/index.js';
import { CLINICAL_BOUNDARY_CATEGORIES } from '../../../common/constants/support-categories.js';
import { IntentSensitivity } from '../../../common/enums/sensitivity.enum.js';
import type { IntelligenceSettings } from '../intelligence-settings.js';
import type { ConversationContextState } from '../context/conversation-context.js';
import {
  SupportDecisionKind,
  type ClarificationOption,
  type SupportDecision,
} from '../interfaces/decision.interface.js';
import {
  clarificationLabelOf,
  type IntentDefinition,
} from '../interfaces/intent-definition.interface.js';
import { EscalationPolicy } from '../interfaces/intent-recognizer.interface.js';
import type { IntentRecognitionResult } from '../interfaces/intent-recognizer.interface.js';
import type { KnowledgeRanking } from '../interfaces/knowledge-match.interface.js';
import type { SafetyAssessment } from '../../safety/safety-rules.js';

export interface DecisionInput {
  settings: IntelligenceSettings;
  safety: SafetyAssessment;
  recognition: IntentRecognitionResult;
  knowledge: KnowledgeRanking;
  context: ConversationContextState;
  intents: IntentDefinition[];
  authenticated: boolean;
  humanHandling: boolean;
  conversationClosed: boolean;
  repeatCount: number;
  followUpFailure: boolean;
  greeting: boolean;
  closing: boolean;
  actionName?: string | null;
  actionParams?: Record<string, string>;
  unsupportedActionReason?: string | null;
}

function decision(
  partial: Omit<SupportDecision, 'empathetic' | 'repeatedQuestion'> & {
    empathetic?: boolean;
    repeatedQuestion?: boolean;
  },
): SupportDecision {
  return {
    empathetic: false,
    repeatedQuestion: false,
    actionName: null,
    actionParams: {},
    unsupportedActionReason: null,
    ...partial,
  };
}

function labels(
  intents: IntentDefinition[],
  names: Array<{ intent: string; category?: string }>,
): ClarificationOption[] {
  return names.slice(0, 3).map((item) => {
    const found = intents.find((intent) => intent.name === item.intent);
    return {
      intent: item.intent,
      label: found ? clarificationLabelOf(found) : item.intent.toLowerCase(),
    };
  });
}

export function decideSupportResponse(input: DecisionInput): SupportDecision {
  const { settings, safety, recognition, knowledge, context } = input;
  const intent = recognition.intent
    ? (input.intents.find((item) => item.name === recognition.intent) ?? null)
    : null;
  const category = recognition.category ?? intent?.category ?? null;
  const confidence = recognition.confidence;
  const empathetic = safety.frustrated;
  const appendDisclaimer = Boolean(
    category && CLINICAL_BOUNDARY_CATEGORIES.has(category),
  );

  if (input.conversationClosed) {
    return decision({
      kind: SupportDecisionKind.ClosedConversation,
      responseType: OrchestratorResponseType.Unsupported,
      reason: 'conversation_closed',
      intent: null,
      category,
      confidence: 0,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer: false,
      countsAsUnresolved: false,
    });
  }

  // Once a specialist owns the chat, stop bot replies (notice is one-shot).
  if (input.humanHandling) {
    return decision({
      kind: SupportDecisionKind.HumanHandling,
      responseType: OrchestratorResponseType.HumanHandling,
      reason: 'human_handling',
      intent: context.currentIntent,
      category,
      confidence,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Medium,
      appendDisclaimer: false,
      countsAsUnresolved: false,
    });
  }

  // Illegal / harmful off-platform asks: quiet redirect, never lecture.
  if (safety.disallowedTopic) {
    return decision({
      kind: SupportDecisionKind.Fallback,
      responseType: OrchestratorResponseType.Unsupported,
      reason: 'disallowed_topic',
      intent: null,
      category,
      confidence: 0,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer: false,
      countsAsUnresolved: false,
      empathetic,
    });
  }

  if (input.closing && !safety.emergency && !safety.humanRequested) {
    return decision({
      kind: SupportDecisionKind.Close,
      responseType: OrchestratorResponseType.Answered,
      reason: 'closing',
      intent: context.currentIntent,
      category,
      confidence,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer: false,
      countsAsUnresolved: false,
    });
  }

  if (
    input.greeting &&
    !safety.emergency &&
    !safety.humanRequested &&
    !recognition.intent
  ) {
    return decision({
      kind: SupportDecisionKind.Greet,
      responseType: OrchestratorResponseType.Answered,
      reason: 'greeting',
      intent: null,
      category: null,
      confidence: 0,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer: false,
      countsAsUnresolved: false,
    });
  }

  const escalate = (reason: string, priority: Priority): SupportDecision =>
    decision({
      kind: SupportDecisionKind.Escalate,
      responseType: OrchestratorResponseType.Escalated,
      reason,
      intent: intent?.name ?? recognition.intent,
      category: intent?.category ?? category,
      confidence,
      knowledge: knowledge.best,
      clarificationOptions: [],
      escalationReason: reason,
      priority,
      appendDisclaimer,
      empathetic,
      countsAsUnresolved:
        reason === 'repeated_failure' || reason === 'frustrated_unresolved',
    });

  // Ask first; open a ticket only after the user says yes.
  // Explicit "talk to a human" already counts as affirmation.
  const offerEscalate = (
    reason: string,
    priority: Priority,
    extras: { appendDisclaimer?: boolean; category?: string | null } = {},
  ): SupportDecision =>
    decision({
      kind: SupportDecisionKind.OfferEscalate,
      responseType: OrchestratorResponseType.ClarificationRequired,
      reason,
      intent: intent?.name ?? recognition.intent,
      category: extras.category ?? intent?.category ?? category,
      confidence,
      knowledge: knowledge.best,
      clarificationOptions: [
        { intent: 'REQUEST_HUMAN', label: 'yes' },
        { intent: 'GENERAL_ENQUIRY', label: 'no' },
      ],
      escalationReason: reason,
      priority,
      appendDisclaimer: extras.appendDisclaimer ?? appendDisclaimer,
      empathetic,
      countsAsUnresolved:
        reason === 'repeated_failure' || reason === 'frustrated_unresolved',
    });

  if (
    safety.emergency ||
    intent?.escalationPolicy === EscalationPolicy.Emergency
  ) {
    return offerEscalate('medical_emergency', Priority.Urgent, {
      appendDisclaimer: true,
      category: intent?.category ?? category ?? 'human_support',
    });
  }

  if (safety.humanRequested || intent?.name === 'REQUEST_HUMAN') {
    return escalate('human_requested', Priority.Medium);
  }
  if (safety.securityIncident || intent?.name === 'SECURITY_INCIDENT') {
    return offerEscalate('security_incident', Priority.Urgent);
  }
  if (
    safety.unauthorizedTransaction ||
    intent?.name === 'WALLET_UNAUTHORIZED'
  ) {
    return offerEscalate('unauthorized_transaction', Priority.Urgent);
  }
  if (safety.seriousComplaint || intent?.name === 'COMPLAINT') {
    return offerEscalate('serious_complaint', Priority.High);
  }
  if (safety.personalClinicalDecision) {
    return offerEscalate('personal_clinical_decision', Priority.High);
  }
  const sensitivePolicy =
    intent?.escalationPolicy === EscalationPolicy.EscalateImmediately ||
    (intent?.sensitivity === IntentSensitivity.High &&
      intent.escalationPolicy !== EscalationPolicy.AnswerFromKnowledge &&
      intent.escalationPolicy !== EscalationPolicy.ActionThenClarify);
  if (sensitivePolicy) {
    return offerEscalate('sensitive_intent', Priority.High);
  }
  if (knowledge.best?.requiresHumanSupport) {
    return offerEscalate('knowledge_requires_human', Priority.Medium);
  }

  if (input.unsupportedActionReason) {
    return decision({
      kind: SupportDecisionKind.UnsupportedAction,
      responseType: OrchestratorResponseType.Unsupported,
      reason: input.unsupportedActionReason,
      intent: intent?.name ?? recognition.intent,
      category,
      confidence,
      knowledge: knowledge.best,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Medium,
      appendDisclaimer: false,
      empathetic,
      countsAsUnresolved: false,
      unsupportedActionReason: input.unsupportedActionReason,
    });
  }

  const requiresAuth = Boolean(
    intent?.requiresAuthentication ||
    knowledge.best?.requiresAuthentication ||
    Boolean(input.actionName),
  );
  if (requiresAuth && !input.authenticated) {
    return decision({
      kind: SupportDecisionKind.Authenticate,
      responseType: OrchestratorResponseType.ClarificationRequired,
      reason: 'authentication_required',
      intent: intent?.name ?? null,
      category,
      confidence,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer: false,
      countsAsUnresolved: false,
    });
  }

  // If the resolver already picked an action (including “do it” after an
  // offered step), run it even when recognition is empty/low-confidence.
  // Short follow-ups like "yes do it" often have requiresClarification=true
  // from emptyResult — that must not block the action.
  if (input.actionName) {
    return decision({
      kind: SupportDecisionKind.RunAction,
      responseType: OrchestratorResponseType.ActionCompleted,
      reason: 'account_action',
      intent: intent?.name ?? recognition.intent,
      category,
      confidence,
      knowledge: null,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer,
      empathetic,
      countsAsUnresolved: false,
      actionName: input.actionName,
      actionParams: input.actionParams ?? {},
    });
  }

  const clarificationOptions = labels(input.intents, [
    ...(recognition.intent
      ? [
          {
            intent: recognition.intent,
            category: recognition.category ?? undefined,
          },
        ]
      : []),
    ...recognition.alternatives,
  ]);
  const knowledgeOptions: ClarificationOption[] = knowledge.ambiguous
    ? knowledge.matches.slice(0, 2).map((match) => ({
        intent: match.intent,
        label: match.title,
        knowledgeId: match.knowledgeId,
      }))
    : [];

  if (input.followUpFailure && context.conversationState === 'answered') {
    return offerEscalate('follow_up_unresolved', Priority.Medium);
  }
  if (input.repeatCount >= settings.maxRepeatedQuestions) {
    return offerEscalate('repeated_question', Priority.Medium);
  }

  const canAnswer =
    Boolean(knowledge.best) &&
    !knowledge.ambiguous &&
    !recognition.requiresClarification &&
    confidence >=
      Math.max(
        settings.autoHandleMinConfidence,
        intent?.confidenceThreshold ?? 0,
      );

  if (canAnswer && knowledge.best) {
    return decision({
      kind: SupportDecisionKind.Answer,
      responseType: OrchestratorResponseType.Answered,
      reason: 'high_confidence_knowledge',
      intent: intent?.name ?? recognition.intent,
      category: knowledge.best.category,
      confidence,
      knowledge: knowledge.best,
      clarificationOptions: [],
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer,
      empathetic,
      repeatedQuestion: input.repeatCount > 0,
      countsAsUnresolved: false,
    });
  }

  if (
    safety.frustrated &&
    context.unsuccessfulAttempts >= 1 &&
    confidence < settings.autoHandleMinConfidence
  ) {
    return offerEscalate('frustrated_unresolved', Priority.Medium);
  }
  if (context.unsuccessfulAttempts >= settings.maxClarificationAttempts) {
    return offerEscalate('repeated_failure', Priority.Medium);
  }

  const shouldClarify =
    knowledge.ambiguous ||
    recognition.requiresClarification ||
    (confidence >= settings.clarificationMinConfidence &&
      confidence < settings.autoHandleMinConfidence) ||
    clarificationOptions.length >= 2;

  if (
    shouldClarify &&
    confidence >= settings.alternativeMinScore &&
    (knowledgeOptions.length >= 2 || clarificationOptions.length >= 1)
  ) {
    return decision({
      kind: SupportDecisionKind.Clarify,
      responseType: OrchestratorResponseType.ClarificationRequired,
      reason: knowledge.ambiguous
        ? 'ambiguous_knowledge'
        : 'ambiguous_or_medium_confidence',
      intent: recognition.intent,
      category,
      confidence,
      knowledge: null,
      clarificationOptions:
        knowledgeOptions.length >= 2 ? knowledgeOptions : clarificationOptions,
      escalationReason: null,
      priority: Priority.Low,
      appendDisclaimer: false,
      empathetic,
      countsAsUnresolved: true,
    });
  }

  return decision({
    kind: SupportDecisionKind.Fallback,
    responseType: OrchestratorResponseType.Unsupported,
    reason: 'low_confidence',
    intent:
      recognition.confidence >= settings.minCandidateScore
        ? recognition.intent
        : null,
    category:
      recognition.confidence >= settings.minCandidateScore ? category : null,
    confidence,
    knowledge: null,
    clarificationOptions: [],
    escalationReason: null,
    priority: Priority.Low,
    appendDisclaimer: false,
    empathetic,
    countsAsUnresolved: true,
  });
}
