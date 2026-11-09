import type { Priority } from '../../common/enums/index.js';

export interface EscalationMessage {
  senderType: string;
  content: string;
}

export interface EscalationRequest {
  conversationId: string;
  userId: string | null;
  category: string;
  intent: string | null;
  confidence: number | null;
  reason: string;
  priority: Priority;
  subject: string;
  originalQuestion: string;
  recentMessages: EscalationMessage[];
  knowledge: Array<{ id: string; title: string }>;
}

export interface EscalationResult {
  ticketId: string;
  ticketNumber: string;
  assignedAgentId: string | null;
  priority: Priority;
  alreadyOpen: boolean;
}
