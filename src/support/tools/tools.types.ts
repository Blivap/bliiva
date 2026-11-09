import type { SupportActor } from '../../common/auth/support-actor.js';
import type { ConversationContextState } from '../intelligence/context/conversation-context.js';
import type {
  ActionChoice,
  ActionStatusName,
  SupportActionDefinition,
} from '../actions/actions.types.js';

export interface ToolCallInput {
  name: string;
  arguments: Record<string, unknown>;
  conversationId: string;
  actor: SupportActor;
  context: ConversationContextState;
  confirmationId?: string;
}

export interface ToolCallOutput {
  status: ActionStatusName | 'unknown_tool' | 'invalid_arguments';
  name: string;
  message: string;
  data?: Record<string, unknown>;
  failureCode?: string;
  confirmationId?: string;
  choices?: ActionChoice[];
  escalate?: boolean;
  definition?: SupportActionDefinition;
  params?: Record<string, string>;
}
