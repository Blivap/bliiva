import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isStaff, type SupportActor } from '../../common/auth/support-actor.js';
import { toPaginatedResult } from '../../common/dto/pagination.dto.js';
import { ConversationStatus, Priority } from '../../common/enums/index.js';
import { MessagesRepository } from '../messages/messages.repository.js';
import { presentMessage } from '../messages/present-message.js';
import { emptyContext } from '../intelligence/context/conversation-context.js';
import { SupportOrchestratorService } from '../intelligence/orchestrator/support-orchestrator.service.js';
import { ConversationsRepository } from './conversations.repository.js';
import type {
  CreateConversationDto,
  SendMessageDto,
} from './dto/conversation.dto.js';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
    private readonly orchestrator: SupportOrchestratorService,
  ) {}

  async create(actor: SupportActor, dto: CreateConversationDto) {
    const created = await this.conversations.create({
      userId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      guestSessionId: actor.guestSessionId,
      status: ConversationStatus.Bot,
      category: dto.category ?? 'general_enquiries',
      currentIntent: null,
      priority: Priority.Medium,
      context: emptyContext() as unknown as Record<string, unknown>,
      lastMessageAt: new Date(),
    });
    return this.presentConversation(created);
  }

  async get(actor: SupportActor, id: string) {
    const conversation = await this.requireAccessible(actor, id);
    return this.presentConversation(conversation);
  }

  async listFor(actor: SupportActor, page: number, limit: number) {
    const filter = ownerFilter(actor);
    if (!filter) {
      return toPaginatedResult([], 0, page, limit);
    }
    const [items, total] = await this.conversations.findPaginated(
      filter,
      page,
      limit,
    );
    const presented = await Promise.all(
      items.map(async (item) => {
        const recent = await this.messages.findRecent(String(item._id), 1);
        const last = recent[0];
        return {
          ...this.presentConversation(item),
          preview:
            last && typeof last.content === 'string'
              ? last.content.slice(0, 160)
              : null,
        };
      }),
    );
    return toPaginatedResult(presented, total, page, limit);
  }

  async messagesFor(
    actor: SupportActor,
    id: string,
    page: number,
    limit: number,
  ) {
    await this.requireAccessible(actor, id);
    const [items, total] = await this.messages.findByConversation(
      id,
      page,
      limit,
    );
    return toPaginatedResult(
      items.map((item) =>
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
      page,
      limit,
    );
  }

  async send(actor: SupportActor, id: string, dto: SendMessageDto) {
    const conversation = await this.requireOwner(actor, id);
    const turn = await this.orchestrator.process(
      {
        id: String(conversation._id),
        userId: conversation.userId ? String(conversation.userId) : null,
        status: conversation.status,
        category: conversation.category,
        currentIntent: conversation.currentIntent,
        priority: conversation.priority,
        context: conversation.context ?? {},
        assignedAgentId: conversation.assignedAgentId
          ? String(conversation.assignedAgentId)
          : null,
      },
      dto.content.trim(),
      actor,
    );
    return {
      conversationId: turn.state.id,
      responseType: turn.responseType,
      reference: turn.reference,
      message: presentMessage(
        {
          id: turn.message.id,
          senderType: turn.message.senderType,
          content: turn.message.content,
          messageType: turn.message.messageType,
          createdAt: turn.message.createdAt,
          metadata: turn.message.metadata,
        },
        actor,
      ),
      state: {
        id: turn.state.id,
        status: turn.state.status,
        category: turn.state.category,
        currentIntent: turn.state.currentIntent,
        priority: turn.state.priority,
        lastMessageAt: turn.state.lastMessageAt,
        state: turn.state.conversationState,
        pendingClarification: turn.state.pendingClarification,
      },
    };
  }

  private async requireAccessible(actor: SupportActor, id: string) {
    const conversation = await this.find(id);
    if (!canAccess(actor, conversation.userId, conversation.guestSessionId)) {
      throw new ForbiddenException('You cannot access this conversation.');
    }
    return conversation;
  }

  private async requireOwner(actor: SupportActor, id: string) {
    const conversation = await this.find(id);
    const owns =
      (conversation.userId &&
        actor.userId &&
        String(conversation.userId) === actor.userId) ||
      (conversation.guestSessionId &&
        actor.guestSessionId &&
        conversation.guestSessionId === actor.guestSessionId);
    if (!owns) {
      throw new ForbiddenException('You cannot access this conversation.');
    }
    return conversation;
  }

  private async find(id: string) {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException('Invalid conversation id.');
    }
    const conversation = await this.conversations.findById(id);
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  private presentConversation(conversation: {
    _id: unknown;
    status: ConversationStatus;
    category: string;
    currentIntent: string | null;
    priority: Priority;
    lastMessageAt: Date;
    context?: Record<string, unknown>;
  }) {
    const context = emptyContext();
    const stored = conversation.context ?? {};
    const state =
      typeof stored.conversationState === 'string'
        ? stored.conversationState
        : context.conversationState;
    const pending = readPendingLabels(stored.pendingClarification);
    return {
      id: String(conversation._id),
      status: conversation.status,
      category: conversation.category,
      currentIntent: conversation.currentIntent,
      priority: conversation.priority,
      lastMessageAt: conversation.lastMessageAt,
      state,
      pendingClarification: pending,
    };
  }
}

function ownerFilter(actor: SupportActor): Record<string, unknown> | null {
  if (actor.userId) {
    return { userId: new Types.ObjectId(actor.userId) };
  }
  if (actor.guestSessionId) {
    return { guestSessionId: actor.guestSessionId };
  }
  return null;
}

function canAccess(
  actor: SupportActor,
  userId: { toString(): string } | null,
  guestSessionId: string | null,
): boolean {
  if (isStaff(actor)) return true;
  if (userId && actor.userId && userId.toString() === actor.userId) return true;
  if (
    guestSessionId &&
    actor.guestSessionId &&
    guestSessionId === actor.guestSessionId
  ) {
    return true;
  }
  return false;
}

function readPendingLabels(
  value: unknown,
): { question: string; options: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const pending = value as { question?: unknown; options?: unknown };
  if (typeof pending.question !== 'string' || !Array.isArray(pending.options)) {
    return null;
  }
  const options = pending.options
    .map((option) =>
      option && typeof option === 'object' && 'label' in option
        ? String((option as { label: unknown }).label)
        : null,
    )
    .filter((label): label is string => Boolean(label));
  return { question: pending.question, options };
}
