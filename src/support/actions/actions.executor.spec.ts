import { describe, expect, it } from 'vitest';
import type { SupportActor } from '../../common/auth/support-actor.js';
import { emptyContext } from '../intelligence/context/conversation-context.js';
import { ActionsConfirmationService } from './actions.confirmation.service.js';
import { ActionsExecutor } from './actions.executor.js';
import { ActionsRegistry } from './actions.registry.js';
import { ActionStatus, type ActionHandler } from './actions.types.js';

const user: SupportActor = {
  userId: '64b0000000000000000000aa',
  guestSessionId: null,
  roles: ['user'],
  isAuthenticated: true,
  accessToken: 'token',
};

const other: SupportActor = {
  ...user,
  userId: '64b0000000000000000000bb',
};

function build(handler?: ActionHandler) {
  const records = new Map<string, unknown>();
  const confirmations = {
    create: async (input: {
      conversationId: string;
      userId: string;
      actionName: string;
      params: Record<string, string>;
      riskLevel: string;
      summary: string;
    }) => {
      const confirmationId = 'confirm-1';
      const record = {
        confirmationId,
        ...input,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        consumedAt: null,
      };
      records.set(confirmationId, record);
      return record;
    },
    consume: async (input: {
      confirmationId: string;
      conversationId: string;
      userId: string;
      actionName: string;
    }) => {
      const record = records.get(input.confirmationId) as
        | {
            conversationId: string;
            userId: string;
            actionName: string;
            params: Record<string, string>;
            consumedAt: string | null;
          }
        | undefined;
      if (!record || record.consumedAt) return null;
      if (
        record.conversationId !== input.conversationId ||
        record.userId !== input.userId ||
        record.actionName !== input.actionName
      ) {
        return null;
      }
      record.consumedAt = new Date().toISOString();
      return { ...record, confirmationId: input.confirmationId };
    },
  } as unknown as ActionsConfirmationService;

  const walletHandler: ActionHandler = handler ?? {
    name: 'get_wallet_summary',
    execute: async (request) => ({
      status: ActionStatus.Success,
      actionName: 'get_wallet_summary',
      message: `balance for ${request.actor.userId}`,
      data: { availableKobo: 1250 },
    }),
  };

  const cancelHandler: ActionHandler = {
    name: 'cancel_booking',
    execute: async (request) => ({
      status: ActionStatus.Success,
      actionName: 'cancel_booking',
      message: `cancelled ${request.params.bookingId}`,
      resourceId: request.params.bookingId,
    }),
  };

  const executor = new ActionsExecutor(
    new ActionsRegistry(),
    confirmations,
    { record: async () => undefined } as never,
    [walletHandler, cancelHandler],
  );

  return { executor, confirmations, records };
}

describe('actions executor', () => {
  it('runs a read-only wallet action for the authenticated user only', async () => {
    const { executor } = build();
    const result = await executor.execute({
      actionName: 'get_wallet_summary',
      conversationId: '64b0000000000000000000c1',
      actor: user,
      params: {},
      context: emptyContext(),
    });
    expect(result.status).toBe(ActionStatus.Success);
    expect(result.message).toContain(user.userId);
  });

  it('rejects unauthenticated and missing access-token callers', async () => {
    const { executor } = build();
    const guest = await executor.execute({
      actionName: 'get_wallet_summary',
      conversationId: '64b0000000000000000000c1',
      actor: {
        userId: null,
        guestSessionId: 'guest-session-1',
        roles: ['user'],
        isAuthenticated: false,
        accessToken: null,
      },
      params: {},
      context: emptyContext(),
    });
    expect(guest.status).toBe(ActionStatus.Rejected);
    expect(guest.failureCode).toBe('unauthenticated');

    const noToken = await executor.execute({
      actionName: 'get_wallet_summary',
      conversationId: '64b0000000000000000000c1',
      actor: { ...user, accessToken: null },
      params: {},
      context: emptyContext(),
    });
    expect(noToken.failureCode).toBe('missing_access_token');
  });

  it('requires a confirmation bound to the same user and conversation', async () => {
    const { executor } = build();
    const conversationId = '64b0000000000000000000c1';
    const pending = await executor.execute({
      actionName: 'cancel_booking',
      conversationId,
      actor: user,
      params: { bookingId: '64b0000000000000000000d1' },
      context: emptyContext(),
    });
    expect(pending.status).toBe(ActionStatus.NeedsConfirmation);
    expect(pending.confirmationId).toBeTruthy();

    const stolen = await executor.execute({
      actionName: 'cancel_booking',
      conversationId,
      actor: other,
      params: { bookingId: '64b0000000000000000000d1' },
      confirmationId: pending.confirmationId,
      context: emptyContext(),
    });
    expect(stolen.status).toBe(ActionStatus.Rejected);
    expect(stolen.failureCode).toBe('confirmation_invalid');

    const otherConversation = await executor.execute({
      actionName: 'cancel_booking',
      conversationId: '64b0000000000000000000c2',
      actor: user,
      params: { bookingId: '64b0000000000000000000d1' },
      confirmationId: pending.confirmationId,
      context: emptyContext(),
    });
    expect(otherConversation.failureCode).toBe('confirmation_invalid');

    const confirmed = await executor.execute({
      actionName: 'cancel_booking',
      conversationId,
      actor: user,
      params: { bookingId: '64b0000000000000000000d1' },
      confirmationId: pending.confirmationId,
      context: emptyContext(),
    });
    expect(confirmed.status).toBe(ActionStatus.Success);
    expect(confirmed.message).toContain('64b0000000000000000000d1');

    const replay = await executor.execute({
      actionName: 'cancel_booking',
      conversationId,
      actor: user,
      params: { bookingId: '64b0000000000000000000d1' },
      confirmationId: pending.confirmationId,
      context: emptyContext(),
    });
    expect(replay.failureCode).toBe('confirmation_invalid');
  });

  it('does not expose an unbound handler', async () => {
    const { executor } = build();
    const result = await executor.execute({
      actionName: 'not_a_real_action',
      conversationId: '64b0000000000000000000c1',
      actor: user,
      params: {},
      context: emptyContext(),
    });
    expect(result.status).toBe(ActionStatus.Rejected);
  });
});
