import type { OrchestratorResponseType } from '../../common/enums/index.js';
import type { ConversationContextState } from '../intelligence/context/conversation-context.js';
import type { RetrievedChunk } from '../rag/rag.types.js';

export type SupportAgentOutcome =
  | 'answered'
  | 'escalate'
  | 'fallback'
  | 'unavailable'
  | 'action_confirmation'
  | 'action_parameter'
  | 'temporary_error';

export interface SupportAgentHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SupportAgentTurnResult {
  outcome: SupportAgentOutcome;
  responseType: OrchestratorResponseType;
  content: string;
  reason: string;
  context: ConversationContextState;
  knowledgeRefs: Array<{ id: string; title: string; score: number }>;
  chunks: RetrievedChunk[];
  toolCalls: number;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  retrievalDurationMs: number;
  errorCode: string | null;
  escalate: boolean;
  escalationReason: string | null;
}
