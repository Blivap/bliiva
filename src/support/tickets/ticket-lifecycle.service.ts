import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  isStaff,
  SupportRole,
  type SupportActor,
} from '../../common/auth/support-actor.js';
import {
  normalizePriority,
  Priority,
  TicketStatus,
} from '../../common/enums/index.js';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../integrations/blivap/index.js';
import { AgentsRepository } from '../agents/agents.repository.js';
import { AuditRepository } from '../audit/audit.repository.js';
import { MessagesRepository } from '../messages/messages.repository.js';
import { presentMessage } from '../messages/present-message.js';
import { assertTransition, isWaitingStatus } from './ticket-transitions.js';
import { TicketsRepository } from './tickets.repository.js';
import type { SupportTicketDocument } from './schemas/ticket.schema.js';

export type TicketStatusUpdateInput = {
  status: TicketStatus;
  resolution?: string;
  cancelReason?: string;
  assignedAgentId?: string | null;
  note?: string;
};

@Injectable()
export class TicketLifecycleService {
  private readonly logger = new Logger(TicketLifecycleService.name);

  constructor(
    private readonly tickets: TicketsRepository,
    private readonly agents: AgentsRepository,
    private readonly audit: AuditRepository,
    private readonly messages: MessagesRepository,
    @Optional()
    @Inject(BLIVAP_INTEGRATION)
    private readonly blivap: BlivapIntegrationPort | null,
  ) {}

  async getForActor(actor: SupportActor, id: string) {
    const ticket = await this.requireTicket(id);
    await this.assertCanAccess(actor, ticket);
    return this.present(ticket);
  }

  async listForActor(
    actor: SupportActor,
    page: number,
    limit: number,
    status?: TicketStatus,
  ) {
    const filter = await this.filterFor(actor);
    if (status) filter.status = status;
    const [items, total] = await this.tickets.findPaginated(
      filter,
      page,
      limit,
    );
    return {
      items: items.map((item) => this.present(item as SupportTicketDocument)),
      total,
    };
  }

  async messagesForActor(
    actor: SupportActor,
    ticketId: string,
    page: number,
    limit: number,
  ) {
    const ticket = await this.requireTicket(ticketId);
    await this.assertCanAccess(actor, ticket);
    const [items, total] = await this.messages.findByConversation(
      String(ticket.conversationId),
      page,
      limit,
    );
    return {
      items: items.map((item) =>
        presentMessage(
          item as unknown as {
            _id?: unknown;
            senderType: typeof item.senderType;
            content: string;
            messageType?: typeof item.messageType;
            createdAt?: Date;
            metadata?: Record<string, unknown>;
          },
          actor,
        ),
      ),
      total,
      conversationId: String(ticket.conversationId),
    };
  }

  async claim(actor: SupportActor, ticketId: string) {
    const ticket = await this.requireTicket(ticketId);
    this.assertStaff(actor);
    const agent = await this.requireAgentProfile(actor);
    if (
      ticket.status !== TicketStatus.Open &&
      ticket.status !== TicketStatus.Assigned &&
      ticket.status !== TicketStatus.Escalated
    ) {
      throw new BadRequestException(
        'Only open, assigned, or escalated tickets can be claimed.',
      );
    }
    return this.applyStatus(actor, ticket, {
      status: TicketStatus.InProgress,
      assignedAgentId: String(agent._id),
      note: 'claimed',
    });
  }

  async updateStatus(
    actor: SupportActor,
    ticketId: string,
    input: TicketStatusUpdateInput,
  ) {
    const ticket = await this.requireTicket(ticketId);
    await this.assertCanAccess(actor, ticket);
    this.assertStaff(actor);
    return this.applyStatus(actor, ticket, input);
  }

  /** System/user reopen after resolved when the user sends another message. */
  async reopenFromUserReply(ticketId: string, userId: string | null) {
    const ticket = await this.requireTicket(ticketId);
    if (ticket.status !== TicketStatus.Resolved) return this.present(ticket);
    return this.applyStatus(
      {
        userId,
        guestSessionId: null,
        roles: [SupportRole.User],
        isAuthenticated: !!userId,
        accessToken: null,
      },
      ticket,
      { status: TicketStatus.Open, note: 'user_replied_after_resolved' },
    );
  }

  async runAutomationPass(now = new Date()) {
    const waitingCutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const resolvedCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const urgentOpenCutoff = new Date(now.getTime() - 60 * 60 * 1000);
    const normalOpenCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let changed = 0;

    const waiting = await this.tickets.findByStatusOlderThan(
      TicketStatus.WaitingOnUser,
      waitingCutoff,
    );
    for (const ticket of waiting) {
      await this.applyStatus(systemActor(), ticket, {
        status: TicketStatus.Resolved,
        resolution: 'Automatically resolved after 72 hours with no user reply.',
        note: 'auto_waiting_on_user_timeout',
      });
      changed += 1;
    }

    const resolved = await this.tickets.findByStatusOlderThan(
      TicketStatus.Resolved,
      resolvedCutoff,
    );
    for (const ticket of resolved) {
      await this.applyStatus(systemActor(), ticket, {
        status: TicketStatus.Closed,
        note: 'auto_resolved_timeout',
      });
      changed += 1;
    }

    const urgentBreaches = await this.tickets.findOpenBreaches(
      urgentOpenCutoff,
      [Priority.Urgent, Priority.High],
    );
    for (const ticket of urgentBreaches) {
      await this.markBreached(ticket, 'urgent_open_sla');
      changed += 1;
    }

    const normalBreaches = await this.tickets.findOpenBreaches(
      normalOpenCutoff,
      [Priority.Medium, Priority.Low],
    );
    for (const ticket of normalBreaches) {
      await this.markBreached(ticket, 'normal_open_sla');
      changed += 1;
    }

    return { changed };
  }

  private async applyStatus(
    actor: SupportActor,
    ticket: SupportTicketDocument,
    input: TicketStatusUpdateInput,
  ) {
    const from = normalizeTicketStatus(ticket.status);
    const to = input.status;
    try {
      assertTransition(from, to);
    } catch {
      throw new BadRequestException(
        `Invalid ticket transition: ${from} → ${to}`,
      );
    }

    const now = new Date();
    const patch: Record<string, unknown> = {
      status: to,
      statusChangedAt: now,
    };

    if (input.assignedAgentId !== undefined) {
      patch.assignedAgentId = input.assignedAgentId
        ? new Types.ObjectId(input.assignedAgentId)
        : null;
      if (input.assignedAgentId && to === TicketStatus.InProgress) {
        await this.tickets.createAssignment({
          ticketId: ticket._id,
          agentId: new Types.ObjectId(input.assignedAgentId),
          assignedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
          method: actor.roles.includes(SupportRole.User) ? 'auto' : 'manual',
          assignedAt: now,
          note: input.note ?? null,
        });
      }
    } else if (
      (to === TicketStatus.InProgress || to === TicketStatus.Assigned) &&
      !ticket.assignedAgentId &&
      actor.userId
    ) {
      const agent = await this.agents.findByUserId(actor.userId);
      if (agent) {
        patch.assignedAgentId = agent._id;
        await this.tickets.createAssignment({
          ticketId: ticket._id,
          agentId: agent._id,
          assignedBy: new Types.ObjectId(actor.userId),
          method: 'manual',
          assignedAt: now,
          note: input.note ?? null,
        });
      }
    }

    if (isWaitingStatus(to)) {
      patch.waitingSince = now;
    } else if (isWaitingStatus(from) && ticket.waitingSince) {
      const spent = now.getTime() - new Date(ticket.waitingSince).getTime();
      patch.waitingDurationMs =
        (ticket.waitingDurationMs ?? 0) + Math.max(0, spent);
      patch.waitingSince = null;
    }

    if (to === TicketStatus.InProgress && !ticket.firstResponseAt) {
      patch.firstResponseAt = now;
    }

    if (to === TicketStatus.Resolved) {
      patch.resolvedAt = now;
      if (input.resolution) patch.resolution = input.resolution;
    }

    if (to === TicketStatus.Closed) {
      patch.closedAt = now;
    }

    if (to === TicketStatus.Cancelled) {
      patch.cancelledAt = now;
      patch.cancelReason = input.cancelReason ?? input.note ?? null;
    }

    if (from === TicketStatus.Resolved && to === TicketStatus.Open) {
      patch.reopenedAt = now;
      patch.reopenCount = (ticket.reopenCount ?? 0) + 1;
      patch.resolvedAt = null;
    }

    if (to === TicketStatus.Escalated && input.note) {
      patch.escalationReason = input.note;
    }

    const updated = await this.tickets.updateTicket(ticket._id, patch);
    if (!updated) throw new NotFoundException('Ticket not found.');

    await this.audit.createAudit({
      action: 'support.ticket.status_changed',
      resourceType: 'ticket',
      resourceId: ticket._id,
      actorId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      actorType: actorTypeOf(actor),
      metadata: {
        ticketNumber: ticket.ticketNumber,
        from,
        to,
        note: input.note ?? null,
        resolution: input.resolution ?? null,
        cancelReason: input.cancelReason ?? null,
      },
    });

    await this.notifyUserIfNeeded(updated, from, to);

    return this.present(updated);
  }

  private async markBreached(ticket: SupportTicketDocument, reason: string) {
    if (ticket.breachedAt) return;
    const updated = await this.tickets.updateTicket(ticket._id, {
      breachedAt: new Date(),
    });
    await this.audit.createAudit({
      action: 'support.ticket.sla_breached',
      resourceType: 'ticket',
      resourceId: ticket._id,
      actorId: null,
      actorType: 'system',
      metadata: {
        ticketNumber: ticket.ticketNumber,
        reason,
        priority: ticket.priority,
      },
    });
    this.logger.warn(
      JSON.stringify({
        event: 'support.ticket.sla_breached',
        ticketId: String(ticket._id),
        ticketNumber: ticket.ticketNumber,
        reason,
      }),
    );
    if (updated) {
      await this.notifyUserIfNeeded(
        updated,
        normalizeTicketStatus(ticket.status),
        normalizeTicketStatus(ticket.status),
        true,
      );
    }
  }

  private async notifyUserIfNeeded(
    ticket: SupportTicketDocument,
    from: TicketStatus,
    to: TicketStatus,
    breachOnly = false,
  ) {
    if (!ticket.userId || !this.blivap) return;

    const userFacing =
      breachOnly ||
      to === TicketStatus.Assigned ||
      to === TicketStatus.InProgress ||
      to === TicketStatus.WaitingOnUser ||
      to === TicketStatus.Resolved ||
      to === TicketStatus.Closed ||
      to === TicketStatus.Cancelled ||
      (from === TicketStatus.Resolved && to === TicketStatus.Open);

    if (!userFacing) return;

    const copy = notificationCopy(ticket.ticketNumber, from, to, breachOnly);
    if (!copy) return;

    try {
      await this.blivap.notifyUser({
        userId: String(ticket.userId),
        title: copy.title,
        body: copy.body,
        type: 'support_ticket_update',
        data: {
          ticketId: String(ticket._id),
          ticketNumber: ticket.ticketNumber,
          status: to,
          conversationId: String(ticket.conversationId),
        },
        channels: ['in_app', 'push'],
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'support.ticket.notify_failed',
          ticketId: String(ticket._id),
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private present(ticket: SupportTicketDocument | Record<string, unknown>) {
    const doc = ticket as SupportTicketDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };
    const status = normalizeTicketStatus(doc.status);
    return {
      id: String(doc._id),
      ticketNumber: doc.ticketNumber,
      conversationId: String(doc.conversationId),
      userId: doc.userId ? String(doc.userId) : null,
      category: doc.category,
      subject: doc.subject,
      description: doc.description,
      priority: normalizePriority(String(doc.priority)),
      status,
      source: doc.source,
      assignedAgentId: doc.assignedAgentId ? String(doc.assignedAgentId) : null,
      resolution: doc.resolution ?? null,
      escalationReason: doc.escalationReason ?? null,
      cancelReason: doc.cancelReason ?? null,
      statusChangedAt: doc.statusChangedAt ?? null,
      waitingSince: doc.waitingSince ?? null,
      firstResponseAt: doc.firstResponseAt ?? null,
      breachedAt: doc.breachedAt ?? null,
      resolvedAt: doc.resolvedAt ?? null,
      closedAt: doc.closedAt ?? null,
      cancelledAt: doc.cancelledAt ?? null,
      reopenedAt: doc.reopenedAt ?? null,
      reopenCount: doc.reopenCount ?? 0,
      waitingDurationMs: doc.waitingDurationMs ?? 0,
      createdAt: doc.createdAt ?? null,
      updatedAt: doc.updatedAt ?? null,
    };
  }

  private async requireTicket(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Ticket not found.');
    }
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  private assertStaff(actor: SupportActor) {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Support staff access is required.');
    }
  }

  private async assertCanAccess(
    actor: SupportActor,
    ticket: SupportTicketDocument,
  ) {
    if (this.isSupervisor(actor)) return;
    if (!isStaff(actor)) {
      throw new ForbiddenException('You cannot access this ticket.');
    }
    const agent = await this.agents.findByUserId(actor.userId ?? '');
    if (!agent || String(ticket.assignedAgentId) !== String(agent._id)) {
      throw new ForbiddenException('You cannot access this ticket.');
    }
  }

  private async filterFor(
    actor: SupportActor,
  ): Promise<Record<string, unknown>> {
    if (this.isSupervisor(actor)) return {};
    const agent = actor.userId
      ? await this.agents.findByUserId(actor.userId)
      : null;
    if (!agent) {
      throw new ForbiddenException('No support agent profile is linked.');
    }
    return { assignedAgentId: agent._id };
  }

  private isSupervisor(actor: SupportActor): boolean {
    return (
      actor.roles.includes(SupportRole.Supervisor) ||
      actor.roles.includes(SupportRole.Administrator)
    );
  }

  private async requireAgentProfile(actor: SupportActor) {
    const agent = actor.userId
      ? await this.agents.findByUserId(actor.userId)
      : null;
    if (!agent) {
      throw new ForbiddenException('No support agent profile is linked.');
    }
    return agent;
  }
}

function systemActor(): SupportActor {
  return {
    userId: null,
    guestSessionId: null,
    roles: [SupportRole.Administrator],
    isAuthenticated: false,
    accessToken: null,
  };
}

function actorTypeOf(actor: SupportActor): string {
  if (!actor.userId) return 'system';
  if (isStaff(actor)) return 'agent';
  return actor.isAuthenticated ? 'user' : 'guest';
}

export function normalizeTicketStatus(
  status: string | TicketStatus,
): TicketStatus {
  if (status === 'waiting_for_user') return TicketStatus.WaitingOnUser;
  if (Object.values(TicketStatus).includes(status as TicketStatus)) {
    return status as TicketStatus;
  }
  return TicketStatus.Open;
}

function notificationCopy(
  ticketNumber: string,
  from: TicketStatus,
  to: TicketStatus,
  breachOnly: boolean,
): { title: string; body: string } | null {
  if (breachOnly) {
    return {
      title: 'Support update',
      body: `Your ticket ${ticketNumber} is taking longer than expected. A supervisor has been notified.`,
    };
  }
  switch (to) {
    case TicketStatus.Assigned:
    case TicketStatus.InProgress:
      return {
        title: 'Specialist assigned',
        body: `A support specialist is working on ticket ${ticketNumber}.`,
      };
    case TicketStatus.WaitingOnUser:
      return {
        title: 'We need a bit more info',
        body: `Please reply in chat for ticket ${ticketNumber} so we can continue helping.`,
      };
    case TicketStatus.Resolved:
      return {
        title: 'Ticket resolved',
        body: `Ticket ${ticketNumber} is marked resolved. Reply in chat if you still need help.`,
      };
    case TicketStatus.Closed:
      return {
        title: 'Ticket closed',
        body: `Ticket ${ticketNumber} is now closed.`,
      };
    case TicketStatus.Cancelled:
      return {
        title: 'Ticket cancelled',
        body: `Ticket ${ticketNumber} was cancelled.`,
      };
    case TicketStatus.Open:
      if (from === TicketStatus.Resolved) {
        return {
          title: 'Ticket reopened',
          body: `We reopened ticket ${ticketNumber} from your latest message.`,
        };
      }
      return null;
    default:
      return null;
  }
}
