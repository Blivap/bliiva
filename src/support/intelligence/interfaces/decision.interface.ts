import type {
  OrchestratorResponseType,
  Priority,
} from '../../../common/enums/index.js';
import type { KnowledgeMatchResult } from './knowledge-match.interface.js';

export enum SupportDecisionKind {
  Answer = 'answer',
  Clarify = 'clarify',
  Fallback = 'fallback',
  Escalate = 'escalate',
  /** Ask before opening a specialist ticket; escalate only after the user says yes. */
  OfferEscalate = 'offer_escalate',
  Emergency = 'emergency',
  Greet = 'greet',
  Close = 'close',
  Authenticate = 'authenticate',
  HumanHandling = 'human_handling',
  ClosedConversation = 'closed_conversation',
  RunAction = 'run_action',
  UnsupportedAction = 'unsupported_action',
}

export interface ClarificationOption {
  intent: string;
  label: string;
  knowledgeId?: string;
  actionName?: string;
  params?: Record<string, string>;
}

export interface SupportDecision {
  kind: SupportDecisionKind;
  responseType: OrchestratorResponseType;
  reason: string;
  intent: string | null;
  category: string | null;
  confidence: number;
  knowledge: KnowledgeMatchResult | null;
  clarificationOptions: ClarificationOption[];
  escalationReason: string | null;
  priority: Priority;
  appendDisclaimer: boolean;
  empathetic: boolean;
  repeatedQuestion: boolean;
  countsAsUnresolved: boolean;
  actionName?: string | null;
  actionParams?: Record<string, string>;
  unsupportedActionReason?: string | null;
}
