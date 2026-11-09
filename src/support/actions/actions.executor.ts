import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { isDuplicateKeyError } from '../../common/auth/mongo-errors.js';
import { ActionsAuditService } from './actions.audit.service.js';
import { ActionsConfirmationService } from './actions.confirmation.service.js';
import { ActionsRegistry } from './actions.registry.js';
import {
  ACTION_HANDLERS,
  ActionStatus,
  type ActionExecutionRequest,
  type ActionExecutionResult,
  type ActionHandler,
  type SupportActionDefinition,
} from './actions.types.js';

@Injectable()
export class ActionsExecutor {
  private readonly logger = new Logger(ActionsExecutor.name);
  private readonly handlers = new Map<string, ActionHandler>();

  constructor(
    private readonly registry: ActionsRegistry,
    private readonly confirmations: ActionsConfirmationService,
    private readonly audit: ActionsAuditService,
    @Inject(ACTION_HANDLERS) handlers: ActionHandler[],
  ) {
    for (const handler of handlers) {
      this.handlers.set(handler.name, handler);
    }
  }

  async execute(
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const definition = this.registry.get(request.actionName);
    if (!definition || !definition.enabled) {
      return rejected(
        request.actionName,
        'Action is not available.',
        'disabled',
      );
    }

    const authError = this.authorize(definition, request);
    if (authError) return authError;

    if (definition.requiresConfirmation && !request.confirmationId) {
      return this.requestConfirmation(definition, request);
    }

    if (definition.requiresConfirmation && request.confirmationId) {
      const confirmed = await this.confirmations.consume({
        confirmationId: request.confirmationId,
        conversationId: request.conversationId,
        userId: request.actor.userId!,
        actionName: definition.name,
      });
      if (!confirmed) {
        const result = rejected(
          definition.name,
          'That confirmation expired or is not valid for this conversation. Ask me again if you still want to continue.',
          'confirmation_invalid',
        );
        await this.safeAudit(definition, request, result);
        return result;
      }
      request.params = { ...confirmed.params, ...request.params };
    }

    const missing = definition.parameters.filter(
      (parameter) => parameter.required && !request.params[parameter.name],
    );
    if (missing.length > 0) {
      const result: ActionExecutionResult = {
        status: ActionStatus.NeedsParameter,
        actionName: definition.name,
        message: `I still need: ${missing.map((item) => item.description).join(', ')}.`,
        failureCode: 'missing_parameters',
      };
      await this.safeAudit(definition, request, result);
      return result;
    }

    const handler = this.handlers.get(definition.handler);
    if (!handler) {
      const result = rejected(
        definition.name,
        'This action is not configured yet.',
        'handler_missing',
      );
      await this.safeAudit(definition, request, result);
      return result;
    }

    try {
      const result = await handler.execute(request);
      await this.safeAudit(definition, request, result, true);
      return result;
    } catch (error) {
      const result = this.mapError(definition.name, error);
      await this.safeAudit(definition, request, result);
      return result;
    }
  }

  private authorize(
    definition: SupportActionDefinition,
    request: ActionExecutionRequest,
  ): ActionExecutionResult | null {
    if (definition.requiresAuthentication && !request.actor.isAuthenticated) {
      return {
        status: ActionStatus.Rejected,
        actionName: definition.name,
        message:
          'Please sign in to continue. Don’t send passwords or codes here.',
        failureCode: 'unauthenticated',
      };
    }
    if (
      definition.requiresAuthentication &&
      request.actor.isAuthenticated &&
      !request.actor.accessToken
    ) {
      return {
        status: ActionStatus.Rejected,
        actionName: definition.name,
        message: 'Open support from the signed-in app and try again.',
        failureCode: 'missing_access_token',
      };
    }
    for (const permission of definition.requiredPermissions) {
      if (!request.actor.roles.includes(permission as never)) {
        return {
          status: ActionStatus.Rejected,
          actionName: definition.name,
          message: 'Permission denied.',
          failureCode: 'forbidden',
        };
      }
    }
    return null;
  }

  private async requestConfirmation(
    definition: SupportActionDefinition,
    request: ActionExecutionRequest,
  ): Promise<ActionExecutionResult> {
    const summary = confirmationSummary(definition, request.params);
    const record = await this.confirmations.create({
      conversationId: request.conversationId,
      userId: request.actor.userId!,
      actionName: definition.name,
      params: request.params,
      riskLevel: definition.riskLevel,
      summary,
    });
    const result: ActionExecutionResult = {
      status: ActionStatus.NeedsConfirmation,
      actionName: definition.name,
      message: [`Confirm? ${summary}`, 'Reply yes or no.'].join('\n'),
      confirmationId: record.confirmationId,
      confirmationSummary: summary,
    };
    await this.safeAudit(definition, request, result);
    return result;
  }

  private mapError(actionName: string, error: unknown): ActionExecutionResult {
    if (error instanceof UnauthorizedException) {
      return rejected(
        actionName,
        httpExceptionMessage(error),
        'unauthenticated',
      );
    }
    if (error instanceof ForbiddenException) {
      return rejected(actionName, httpExceptionMessage(error), 'forbidden');
    }
    const message =
      error instanceof Error ? error.message : 'The account service failed.';
    this.logger.warn(
      JSON.stringify({
        event: 'support.action.failed',
        actionName,
        message,
      }),
    );
    return {
      status: ActionStatus.Failed,
      actionName,
      message: 'Lookup failed. Try again or ask for a specialist.',
      failureCode: 'service_error',
      escalate: true,
    };
  }

  private async safeAudit(
    definition: SupportActionDefinition,
    request: ActionExecutionRequest,
    result: ActionExecutionResult,
    executed = false,
  ): Promise<void> {
    try {
      await this.audit.record({
        conversationId: request.conversationId,
        messageId: request.messageId,
        authenticatedUserId: request.actor.userId,
        actionName: definition.name,
        resourceType: result.resourceType,
        resourceId: result.resourceId,
        status: result.status,
        riskLevel: definition.riskLevel,
        confirmationRequired: definition.requiresConfirmation,
        confirmedAt: request.confirmationId ? new Date() : undefined,
        executedAt: executed ? new Date() : undefined,
        failureCode: result.failureCode,
        idempotencyKey: request.idempotencyKey ?? null,
        safeInput: {
          paramKeys: Object.keys(request.params),
        },
        safeResult: {
          status: result.status,
          hasChoices: Boolean(result.choices?.length),
        },
        errorMessage:
          result.status === ActionStatus.Failed ||
          result.status === ActionStatus.Rejected
            ? (result.failureCode ?? null)
            : null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error) && request.idempotencyKey) {
        return;
      }
      this.logger.error(
        JSON.stringify({
          event: 'support.action.audit_failed',
          actionName: definition.name,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }
}

function rejected(
  actionName: string,
  message: string,
  failureCode: string,
): ActionExecutionResult {
  return {
    status: ActionStatus.Rejected,
    actionName,
    message,
    failureCode,
  };
}

function httpExceptionMessage(
  error: UnauthorizedException | ForbiddenException,
): string {
  const body = error.getResponse();
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: string | string[] }).message;
    if (Array.isArray(message) && message[0]) return message.join(' ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error.message || 'Please sign in and try again.';
}

function confirmationSummary(
  definition: SupportActionDefinition,
  params: Record<string, string>,
): string {
  if (definition.name === 'cancel_booking') {
    return `Cancel booking ${params.bookingId ?? '(selected booking)'} on this account.`;
  }
  if (definition.name === 'update_notification_settings') {
    return `Set push notifications to ${params.pushEnabled === 'false' ? 'off' : 'on'} for this account.`;
  }
  if (definition.name === 'resend_email_verification') {
    return 'Resend the email verification link to the address already on this account.';
  }
  return `Run ${definition.name}.`;
}
