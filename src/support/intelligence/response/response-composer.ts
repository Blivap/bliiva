import { CLINICAL_BOUNDARY_CATEGORIES } from '../../../common/constants/support-categories.js';
import {
  SupportDecisionKind,
  type SupportDecision,
} from '../interfaces/decision.interface.js';

export interface ComposedResponse {
  content: string;
  knowledgeId: string | null;
  knowledgeTitle: string | null;
}

/** Off-topic / ungrounded asks — redirect without offering a specialist. */
export const SCOPE_REDIRECT_MESSAGE =
  'Please ask a question about the Blivap app, or tell me about a problem you’re facing.';

const CLINICAL_DISCLAIMER =
  'General info only — eligibility and medical decisions stay with qualified staff.';

const EMERGENCY_MESSAGE =
  'If this is a medical emergency, contact local emergency services or go to the nearest hospital now. Do not wait for chat. A specialist has been notified.';

const EMERGENCY_WITHOUT_TICKET =
  'If this is a medical emergency, contact local emergency services or go to the nearest hospital now. Do not wait for chat.';

function join(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n\n');
}

function listOptions(labels: string[]): string {
  if (labels.length === 0) return 'that';
  if (labels.length === 1) return labels[0] ?? 'that';
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

export function composeResponse(
  decision: SupportDecision,
  options: { ticketQueued?: boolean; userName?: string | null } = {},
): ComposedResponse {
  const empathy = decision.empathetic ? 'Sorry about that.' : null;
  const repeat = decision.repeatedQuestion ? 'Same answer as before:' : null;
  const disclaimer =
    decision.appendDisclaimer ||
    (decision.category && CLINICAL_BOUNDARY_CATEGORIES.has(decision.category))
      ? CLINICAL_DISCLAIMER
      : null;
  const knowledge = decision.knowledge;

  switch (decision.kind) {
    case SupportDecisionKind.Emergency:
      return {
        content: options.ticketQueued
          ? EMERGENCY_MESSAGE
          : EMERGENCY_WITHOUT_TICKET,
        knowledgeId: knowledge?.knowledgeId ?? null,
        knowledgeTitle: knowledge?.title ?? null,
      };
    case SupportDecisionKind.Greet:
      return {
        content: greetingMessage(options.userName),
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.Close:
      return {
        content: 'You’re welcome. Message anytime.',
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.Authenticate:
      return {
        content: 'Please sign in to continue.',
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.HumanHandling:
      return {
        content: 'A specialist is on this chat now.',
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.ClosedConversation:
      return {
        content: 'This chat is closed. Start a new one.',
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.Answer:
      return {
        content: join([empathy, repeat, knowledge?.answer, disclaimer]),
        knowledgeId: knowledge?.knowledgeId ?? null,
        knowledgeTitle: knowledge?.title ?? null,
      };
    case SupportDecisionKind.Clarify: {
      const labels = decision.clarificationOptions.map(
        (option) => option.label,
      );
      const question =
        labels.length >= 2
          ? `About ${listOptions(labels)}?`
          : labels.length === 1
            ? `About ${labels[0]}?`
            : 'Account, donation, blood request, or wallet?';
      return {
        content: join([empathy, question]),
        knowledgeId: null,
        knowledgeTitle: null,
      };
    }
    case SupportDecisionKind.UnsupportedAction:
      return {
        content: join([
          empathy,
          unsupportedActionMessage(decision.unsupportedActionReason),
          knowledge?.answer ?? null,
        ]),
        knowledgeId: knowledge?.knowledgeId ?? null,
        knowledgeTitle: knowledge?.title ?? null,
      };
    case SupportDecisionKind.RunAction:
      return {
        content: join([empathy, 'Looking that up…']),
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.Fallback:
      return {
        content: join([empathy, SCOPE_REDIRECT_MESSAGE]),
        knowledgeId: null,
        knowledgeTitle: null,
      };
    case SupportDecisionKind.Escalate:
      return {
        content: join([
          empathy,
          escalationBody(decision.reason, knowledge?.answer ?? null),
          disclaimer,
          handoff(decision.reason, options.ticketQueued !== false),
        ]),
        knowledgeId: knowledge?.knowledgeId ?? null,
        knowledgeTitle: knowledge?.title ?? null,
      };
    default:
      return {
        content: 'Something went wrong. Try again shortly.',
        knowledgeId: null,
        knowledgeTitle: null,
      };
  }
}

function escalationBody(reason: string, answer: string | null): string | null {
  if (reason === 'personal_clinical_decision') {
    return (
      answer ??
      'I can’t decide eligibility, fitness, verification, or blood compatibility.'
    );
  }
  if (
    answer &&
    reason !== 'security_incident' &&
    reason !== 'unauthorized_transaction'
  ) {
    return answer;
  }
  return null;
}

function handoff(reason: string, queued: boolean): string {
  const queuedText = queued
    ? 'A specialist will continue.'
    : 'Couldn’t reach a specialist. Try again shortly.';
  switch (reason) {
    case 'human_requested':
      return `Connecting you to a human. ${queuedText}`;
    case 'security_incident':
      return `Thanks — don’t send passwords or codes here. ${queuedText}`;
    case 'unauthorized_transaction':
      return `Thanks — don’t send passwords or codes here. ${queuedText}`;
    case 'serious_complaint':
      return `Sorry about this. ${queuedText}`;
    case 'personal_clinical_decision':
      return `Platform help only; medical decisions need clinicians. ${queuedText}`;
    case 'repeated_failure':
    case 'frustrated_unresolved':
    case 'follow_up_unresolved':
    case 'repeated_question':
      return `Still unresolved. ${queuedText}`;
    default:
      return queuedText;
  }
}

export function temporaryErrorMessage(): string {
  return 'Couldn’t process that. Try again shortly.';
}

function unsupportedActionMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'wallet_mutation_unsupported':
      return 'I can’t move money from chat. Open Wallet in the app to withdraw or transfer. I can show your balance here, or connect you to a specialist if something looks wrong.';
    case 'blood_request_cancel_unsupported':
      return 'I can’t cancel blood requests from chat. I can show status or escalate.';
    default:
      return 'That action isn’t available from chat.';
  }
}

function greetingMessage(userName?: string | null): string {
  const name = sanitizeDisplayName(userName);
  return name
    ? `Hi ${name} — I’m Blivap’s official AI support assistant. How can I help?`
    : 'Hi — I’m Blivap’s official AI support assistant. How can I help?';
}

function sanitizeDisplayName(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 60) return null;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u.test(cleaned)) return null;
  return cleaned;
}
