import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BLIVAP_INTEGRATION,
  type BlivapIntegrationPort,
} from '../../integrations/blivap/index.js';
import type {
  EscalationRequest,
  EscalationResult,
} from './escalation.types.js';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @Inject(BLIVAP_INTEGRATION)
    private readonly blivap: BlivapIntegrationPort,
  ) {}

  /**
   * Escalation is owned by Blivap. This forwards the handoff and returns
   * the ticket Blivap opened.
   */
  async escalate(request: EscalationRequest): Promise<EscalationResult> {
    const created = await this.blivap.escalateSupport({
      conversationId: request.conversationId,
      userId: request.userId,
      category: request.category,
      subject: request.subject.slice(0, 180),
      originalQuestion: request.originalQuestion.slice(0, 2000),
      reason: request.reason.slice(0, 200),
      priority: request.priority,
      intent: request.intent,
      confidence: request.confidence,
      recentMessages: request.recentMessages.slice(-40).map((message) => ({
        senderType: message.senderType,
        content: message.content.slice(0, 8000),
        createdAt: message.createdAt,
      })),
      knowledge: request.knowledge.slice(0, 20).map((item) => ({
        id: item.id.slice(0, 80),
        title: item.title.slice(0, 200),
      })),
    });
    this.logger.log(
      JSON.stringify({
        event: created.alreadyOpen
          ? 'support.escalation.already_open'
          : 'support.escalation.created',
        ticketId: created.ticketId,
        ticketNumber: created.ticketNumber,
        category: request.category,
      }),
    );
    return {
      ticketId: created.ticketId,
      ticketNumber: created.ticketNumber,
      assignedAgentId: created.assignedAgentId,
      priority: created.priority ?? request.priority,
      alreadyOpen: created.alreadyOpen,
    };
  }
}
