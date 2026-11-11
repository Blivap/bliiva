import type { ClarificationOption } from '../interfaces/decision.interface.js';
import { normalizeText } from '../text/text-normalizer.js';
import type { UtteranceSignals } from '../text/utterances.js';
import {
  botOfferedAction,
  isGoAhead,
  priorUserAskedForLiveData,
} from './offered-action.js';

export type ConversationContextMode =
  | 'idle'
  | 'clarifying'
  | 'answered'
  | 'escalated'
  | 'closing'
  | 'awaiting_action_confirmation'
  | 'awaiting_action_parameter';

export interface PendingClarification {
  kind:
    | 'intent'
    | 'knowledge'
    | 'follow_up'
    | 'action_resource'
    | 'action_confirm'
    | 'action_offer'
    | 'escalation_confirm';
  question: string;
  options: ClarificationOption[];
  actionName?: string;
  confirmationId?: string;
  escalationReason?: string;
  priority?: string;
}

export interface ConversationContextState {
  version: 1;
  currentIntent: string | null;
  previousIntent: string | null;
  lastUserMessage: string | null;
  lastUserMessageNormalized: string | null;
  lastBotResponse: string | null;
  lastClarificationQuestion: string | null;
  pendingClarification: PendingClarification | null;
  recognizedEntities: Record<string, string>;
  conversationState: ConversationContextMode;
  unsuccessfulAttempts: number;
  presentedKnowledgeIds: string[];
  frustrated: boolean;
  repeatCount: number;
  pendingActionName: string | null;
  pendingActionParams: Record<string, string>;
  pendingConfirmationId: string | null;
  /** True after the user has been told a specialist is taking over. */
  specialistNotified: boolean;
}

export function emptyContext(): ConversationContextState {
  return {
    version: 1,
    currentIntent: null,
    previousIntent: null,
    lastUserMessage: null,
    lastUserMessageNormalized: null,
    lastBotResponse: null,
    lastClarificationQuestion: null,
    pendingClarification: null,
    recognizedEntities: {},
    conversationState: 'idle',
    unsuccessfulAttempts: 0,
    presentedKnowledgeIds: [],
    frustrated: false,
    repeatCount: 0,
    pendingActionName: null,
    pendingActionParams: {},
    pendingConfirmationId: null,
    specialistNotified: false,
  };
}

export function readContext(raw: unknown): ConversationContextState {
  const base = emptyContext();
  if (!raw || typeof raw !== 'object') return base;
  const record = raw as Partial<ConversationContextState>;
  return {
    ...base,
    currentIntent: stringOrNull(record.currentIntent),
    previousIntent: stringOrNull(record.previousIntent),
    lastUserMessage: stringOrNull(record.lastUserMessage),
    lastUserMessageNormalized: stringOrNull(record.lastUserMessageNormalized),
    lastBotResponse: stringOrNull(record.lastBotResponse),
    lastClarificationQuestion: stringOrNull(record.lastClarificationQuestion),
    pendingClarification: readPending(record.pendingClarification),
    recognizedEntities: readEntities(record.recognizedEntities),
    conversationState: readMode(record.conversationState),
    unsuccessfulAttempts: numberOrZero(record.unsuccessfulAttempts),
    presentedKnowledgeIds: Array.isArray(record.presentedKnowledgeIds)
      ? record.presentedKnowledgeIds.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    frustrated: record.frustrated === true,
    repeatCount: numberOrZero(record.repeatCount),
    pendingActionName: stringOrNull(record.pendingActionName),
    pendingActionParams: readEntities(record.pendingActionParams),
    pendingConfirmationId: stringOrNull(record.pendingConfirmationId),
    specialistNotified: record.specialistNotified === true,
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readMode(value: unknown): ConversationContextMode {
  if (
    value === 'idle' ||
    value === 'clarifying' ||
    value === 'answered' ||
    value === 'escalated' ||
    value === 'closing' ||
    value === 'awaiting_action_confirmation' ||
    value === 'awaiting_action_parameter'
  ) {
    return value;
  }
  return 'idle';
}

function readEntities(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const entities: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') entities[key] = entry;
  }
  return entities;
}

function readPending(value: unknown): PendingClarification | null {
  if (!value || typeof value !== 'object') return null;
  const pending = value as Partial<PendingClarification>;
  if (
    pending.kind !== 'intent' &&
    pending.kind !== 'knowledge' &&
    pending.kind !== 'follow_up' &&
    pending.kind !== 'action_resource' &&
    pending.kind !== 'action_confirm' &&
    pending.kind !== 'action_offer' &&
    pending.kind !== 'escalation_confirm'
  ) {
    return null;
  }
  if (typeof pending.question !== 'string') return null;
  const options = Array.isArray(pending.options)
    ? pending.options.filter(
        (option): option is ClarificationOption =>
          Boolean(option) &&
          typeof option === 'object' &&
          typeof (option as ClarificationOption).intent === 'string' &&
          typeof (option as ClarificationOption).label === 'string',
      )
    : [];
  return {
    kind: pending.kind,
    question: pending.question,
    options,
    actionName:
      typeof pending.actionName === 'string' ? pending.actionName : undefined,
    confirmationId:
      typeof pending.confirmationId === 'string'
        ? pending.confirmationId
        : undefined,
    escalationReason:
      typeof pending.escalationReason === 'string'
        ? pending.escalationReason
        : undefined,
    priority: typeof pending.priority === 'string' ? pending.priority : undefined,
  };
}

export type PendingResolution =
  | { type: 'none' }
  | { type: 'select'; option: ClarificationOption }
  | { type: 'affirm' }
  | { type: 'reject' };

export function resolvePendingReply(
  state: ConversationContextState,
  normalized: string,
  utterance: UtteranceSignals,
): PendingResolution {
  const pending = state.pendingClarification;
  if (!pending) return { type: 'none' };

  // Confirmations / offered lookups: yes, soft ack, and "do it" all proceed.
  if (
    pending.kind === 'action_confirm' ||
    pending.kind === 'action_offer' ||
    pending.kind === 'escalation_confirm'
  ) {
    if (
      utterance.affirmation ||
      utterance.softAck ||
      utterance.actionGoAhead ||
      isGoAhead(utterance, normalized)
    ) {
      return { type: 'affirm' };
    }
  }

  // Post-answer "Anything else?":
  // - If the bot offered a lookup, OR the prior user ask was live data
  //   (balance/bookings/…) and they say yes — accept as go-ahead.
  // - soft ack / thanks → done (affirm → Close)
  // - bare "yes" with no offer/prior ask → stay open (reject)
  if (pending.kind === 'follow_up') {
    if (
      isGoAhead(utterance, normalized) &&
      (botOfferedAction(state.lastBotResponse) ||
        priorUserAskedForLiveData(state.lastUserMessage))
    ) {
      return { type: 'affirm' };
    }
    if (utterance.actionGoAhead) return { type: 'none' };
    if (utterance.softAck || utterance.closing) return { type: 'affirm' };
    if (utterance.affirmation) return { type: 'reject' };
  }

  if (
    (utterance.negation || utterance.correction) &&
    !utterance.correctionRemainder
  ) {
    return { type: 'reject' };
  }
  if (utterance.ordinal !== null && pending.options[utterance.ordinal]) {
    return { type: 'select', option: pending.options[utterance.ordinal] };
  }
  if (utterance.selection && pending.options[0]) {
    return { type: 'select', option: pending.options[0] };
  }
  if (
    (utterance.affirmation || utterance.softAck || utterance.actionGoAhead) &&
    pending.options.length === 1
  ) {
    return { type: 'select', option: pending.options[0] };
  }

  const direct = pending.options.find((option) => {
    const label = normalizeText(option.label);
    if (!label) return false;
    return (
      normalized === label ||
      (label.length > 3 && normalized.includes(label)) ||
      (normalized.length > 3 && label.includes(normalized))
    );
  });
  if (direct) return { type: 'select', option: direct };
  return { type: 'none' };
}

export function nextRepeatCount(
  state: ConversationContextState,
  normalized: string,
): number {
  if (
    state.lastUserMessageNormalized &&
    state.lastUserMessageNormalized === normalized
  ) {
    return state.repeatCount + 1;
  }
  return 0;
}
