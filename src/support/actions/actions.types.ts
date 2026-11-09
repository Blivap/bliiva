import type { SupportActor } from '../../common/auth/support-actor.js';
import type { ConversationContextState } from '../intelligence/context/conversation-context.js';

export const ActionRiskLevel = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;

export type ActionRiskLevelName =
  (typeof ActionRiskLevel)[keyof typeof ActionRiskLevel];

export const ActionStatus = {
  Pending: 'pending',
  Success: 'success',
  Failed: 'failed',
  Rejected: 'rejected',
  NeedsConfirmation: 'needs_confirmation',
  NeedsParameter: 'needs_parameter',
} as const;

export type ActionStatusName = (typeof ActionStatus)[keyof typeof ActionStatus];

export interface SupportActionParameter {
  name: string;
  description: string;
  required: boolean;
  source: 'context' | 'user' | 'system';
}

export interface SupportActionDefinition {
  name: string;
  description: string;
  category: string;
  intents: string[];
  requiresAuthentication: boolean;
  requiresConfirmation: boolean;
  requiredPermissions: string[];
  riskLevel: ActionRiskLevelName;
  readOnly: boolean;
  enabled: boolean;
  parameters: SupportActionParameter[];
  handler: string;
}

export interface ActionExecutionRequest {
  actionName: string;
  conversationId: string;
  messageId?: string;
  actor: SupportActor;
  params: Record<string, string>;
  confirmationId?: string;
  idempotencyKey?: string;
  context: ConversationContextState;
}

export interface ActionChoice {
  id: string;
  label: string;
  params: Record<string, string>;
}

export interface ActionExecutionResult {
  status: ActionStatusName;
  actionName: string;
  message: string;
  data?: Record<string, unknown>;
  choices?: ActionChoice[];
  confirmationId?: string;
  confirmationSummary?: string;
  resourceType?: string;
  resourceId?: string;
  failureCode?: string;
  escalate?: boolean;
}

export interface ActionHandler {
  readonly name: string;
  execute(request: ActionExecutionRequest): Promise<ActionExecutionResult>;
}

export const ACTION_HANDLERS = Symbol('ACTION_HANDLERS');
