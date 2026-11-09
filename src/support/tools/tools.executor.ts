import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { ActionsExecutor } from '../actions/actions.executor.js';
import { AuditRepository } from '../audit/audit.repository.js';
import { ActionStatus } from '../actions/actions.types.js';
import { sanitizeForModel } from '../llm/redaction.js';
import { authorizeToolCall } from './tools.authorization.js';
import { ToolsRegistry } from './tools.registry.js';
import type { ToolCallInput, ToolCallOutput } from './tools.types.js';
import { validateToolArguments } from './tools.validator.js';

@Injectable()
export class ToolsExecutor {
  constructor(
    private readonly registry: ToolsRegistry,
    private readonly actions: ActionsExecutor,
    private readonly audit: AuditRepository,
  ) {}

  async execute(input: ToolCallInput): Promise<ToolCallOutput> {
    if (!/^[a-z][a-z0-9_]{1,64}$/.test(input.name)) {
      return unknown(input.name);
    }
    const definition = this.registry.get(input.name);
    if (!definition) return unknown(input.name);

    const authorized = authorizeToolCall(
      definition,
      input.actor,
      input.arguments,
    );
    if (!authorized.ok) {
      return {
        status: ActionStatus.Rejected,
        name: input.name,
        message: authorized.message,
        failureCode: authorized.code,
        definition,
      };
    }

    const validated = validateToolArguments(definition, authorized.args);
    if (!validated.ok) {
      return {
        status: 'invalid_arguments',
        name: input.name,
        message: validated.message,
        failureCode: 'invalid_arguments',
        definition,
      };
    }

    const idempotencyKey = definition.readOnly
      ? undefined
      : modificationKey(
          input.conversationId,
          definition.name,
          validated.params,
        );
    if (idempotencyKey) {
      const previous = await this.audit.findActionByIdempotency(idempotencyKey);
      if (previous) {
        return {
          status: ActionStatus.Rejected,
          name: input.name,
          message:
            'That change was already completed for this conversation. I will not run it again.',
          failureCode: 'duplicate_modification',
          definition,
        };
      }
    }

    const result = await this.actions.execute({
      actionName: definition.name,
      conversationId: input.conversationId,
      actor: input.actor,
      params: validated.params,
      confirmationId: input.confirmationId,
      idempotencyKey,
      context: input.context,
    });
    const data = sanitizeForModel(result.data);
    return {
      status: result.status,
      name: result.actionName,
      message: result.message,
      data:
        data && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : undefined,
      failureCode: result.failureCode,
      confirmationId: result.confirmationId,
      choices: result.choices,
      escalate: result.escalate,
      definition,
      params: validated.params,
    };
  }
}

function unknown(name: string): ToolCallOutput {
  return {
    status: 'unknown_tool',
    name,
    message: 'That action is not available.',
    failureCode: 'unknown_tool',
  };
}

function modificationKey(
  conversationId: string,
  name: string,
  params: Record<string, string>,
): string {
  const stable = JSON.stringify(
    Object.keys(params)
      .sort()
      .map((key) => [key, params[key]]),
  );
  const digest = createHash('sha256').update(stable).digest('hex').slice(0, 16);
  const conversation = Types.ObjectId.isValid(conversationId)
    ? conversationId
    : 'conversation';
  return `${conversation}:${name}:${digest}`;
}
