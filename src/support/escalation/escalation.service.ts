import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/auth/mongo-errors.js';
import { TicketStatus } from '../../common/enums/index.js';
import { AgentsRepository } from '../agents/agents.repository.js';
import { TicketsRepository } from '../tickets/tickets.repository.js';
import type {
  EscalationRequest,
  EscalationResult,
} from './escalation.types.js';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly tickets: TicketsRepository,
    private readonly agents: AgentsRepository,
  ) {}

  async escalate(request: EscalationRequest): Promise<EscalationResult> {
    const conversationId = new Types.ObjectId(request.conversationId);
    const userId = request.userId ? new Types.ObjectId(request.userId) : null;
    const existing = await this.tickets.findActiveByConversation(
      conversationId,
      request.category,
    );
    if (existing) {
      return {
        ticketId: String(existing._id),
        ticketNumber: existing.ticketNumber,
        assignedAgentId: existing.assignedAgentId
          ? String(existing.assignedAgentId)
          : null,
        priority: existing.priority,
        alreadyOpen: true,
      };
    }

    const agentId = await this.pickAgent(request.category);
    const description = renderDescription(request);
    try {
      const ticket = await this.tickets.createTicket({
        ticketNumber: createTicketNumber(),
        conversationId,
        userId,
        category: request.category,
        subject: request.subject.slice(0, 180),
        description,
        priority: request.priority,
        status: agentId ? TicketStatus.Assigned : TicketStatus.Open,
        assignedAgentId: agentId,
        escalationReason: request.reason,
      });
      if (agentId) {
        await this.tickets.createAssignment({
          ticketId: ticket._id,
          agentId,
          assignedBy: null,
          method: 'auto',
          assignedAt: new Date(),
          note: request.reason,
        });
      }
      return {
        ticketId: String(ticket._id),
        ticketNumber: ticket.ticketNumber,
        assignedAgentId: agentId ? String(agentId) : null,
        priority: ticket.priority,
        alreadyOpen: false,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await this.tickets.findActiveByConversation(
        conversationId,
        request.category,
      );
      if (!raced) throw error;
      return {
        ticketId: String(raced._id),
        ticketNumber: raced.ticketNumber,
        assignedAgentId: raced.assignedAgentId
          ? String(raced.assignedAgentId)
          : null,
        priority: raced.priority,
        alreadyOpen: true,
      };
    }
  }

  private async pickAgent(category: string): Promise<Types.ObjectId | null> {
    const agents = await this.agents.findActiveOnline();
    let chosen: Types.ObjectId | null = null;
    let lowest = Number.POSITIVE_INFINITY;
    for (const agent of agents) {
      const skills = agent.skills ?? [];
      const skillMatch =
        skills.length === 0 ||
        skills.includes(category) ||
        skills.includes('general');
      if (!skillMatch) continue;
      const load = await this.tickets.countActiveByAgent(agent._id);
      if (load >= agent.maxActiveTickets) continue;
      if (load < lowest) {
        lowest = load;
        chosen = agent._id;
      }
    }
    if (!chosen) {
      this.logger.log(
        JSON.stringify({ event: 'support.escalation.unassigned', category }),
      );
    }
    return chosen;
  }
}

function createTicketNumber(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SUP-${year}${month}${day}-${suffix}`;
}

function renderDescription(request: EscalationRequest): string {
  const messages = request.recentMessages
    .slice(-8)
    .map((message) => `${message.senderType}: ${message.content.slice(0, 500)}`)
    .join('\n');
  const knowledge = request.knowledge.length
    ? request.knowledge.map((item) => `${item.title} (${item.id})`).join(', ')
    : 'none';
  return [
    `Reason: ${request.reason}`,
    `Category: ${request.category}`,
    `Intent: ${request.intent ?? 'unrecognized'}`,
    `Confidence: ${request.confidence ?? 'n/a'}`,
    `Original question: ${request.originalQuestion.slice(0, 500)}`,
    `Knowledge already presented: ${knowledge}`,
    'Recent messages:',
    messages || 'none',
  ].join('\n');
}
