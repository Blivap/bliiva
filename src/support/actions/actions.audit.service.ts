import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditRepository } from '../audit/audit.repository.js';
import type { ActionRiskLevelName, ActionStatusName } from './actions.types.js';

export interface ActionAuditInput {
  conversationId: string;
  messageId?: string;
  authenticatedUserId?: string | null;
  actionName: string;
  resourceType?: string;
  resourceId?: string;
  status: ActionStatusName;
  riskLevel: ActionRiskLevelName;
  confirmationRequired: boolean;
  confirmedAt?: Date;
  executedAt?: Date;
  failureCode?: string;
  idempotencyKey?: string | null;
  safeInput?: Record<string, unknown>;
  safeResult?: Record<string, unknown>;
  errorMessage?: string | null;
}

@Injectable()
export class ActionsAuditService {
  constructor(private readonly audit: AuditRepository) {}

  async record(input: ActionAuditInput): Promise<void> {
    await this.audit.createActionLog({
      conversationId: new Types.ObjectId(input.conversationId),
      userId: input.authenticatedUserId
        ? new Types.ObjectId(input.authenticatedUserId)
        : null,
      actionName: input.actionName,
      status: input.status,
      idempotencyKey: input.idempotencyKey ?? null,
      input: {
        ...input.safeInput,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        riskLevel: input.riskLevel,
        confirmationRequired: input.confirmationRequired,
        confirmedAt: input.confirmedAt?.toISOString() ?? null,
        messageId: input.messageId ?? null,
      },
      result: {
        ...input.safeResult,
        executedAt: input.executedAt?.toISOString() ?? null,
        failureCode: input.failureCode ?? null,
      },
      errorMessage: input.errorMessage ?? null,
    });

    await this.audit.createAudit({
      action: `support.action.${input.status}`,
      resourceType: input.resourceType ?? 'action',
      resourceId:
        input.resourceId && Types.ObjectId.isValid(input.resourceId)
          ? new Types.ObjectId(input.resourceId)
          : null,
      actorId: input.authenticatedUserId
        ? new Types.ObjectId(input.authenticatedUserId)
        : null,
      actorType: input.authenticatedUserId ? 'user' : 'guest',
      metadata: {
        conversationId: input.conversationId,
        actionName: input.actionName,
        riskLevel: input.riskLevel,
        failureCode: input.failureCode ?? null,
      },
    });
  }
}
