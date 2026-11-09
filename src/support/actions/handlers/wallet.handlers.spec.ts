import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { SupportActor } from '../../../common/auth/support-actor.js';
import type { BlivapIntegrationPort } from '../../../integrations/blivap/index.js';
import { emptyContext } from '../../intelligence/context/conversation-context.js';
import { GetWalletSummaryHandler } from './wallet.handlers.js';

const user: SupportActor = {
  userId: '64b0000000000000000000aa',
  guestSessionId: null,
  roles: ['user'],
  isAuthenticated: true,
  accessToken: 'token-a',
};

describe('wallet handler ownership', () => {
  it('always calls Blivap with the authenticated actor, never a chat user id', async () => {
    const calls: Array<{ userId: string; accessToken: string }> = [];
    const blivap = {
      getWalletSummary: async (ctx: {
        userId: string;
        accessToken: string;
      }) => {
        calls.push(ctx);
        return {
          availableKobo: 2500,
          heldKobo: 0,
          payoutHeldKobo: 0,
          currency: 'NGN',
          entries: [],
        };
      },
    } as unknown as BlivapIntegrationPort;
    const handler = new GetWalletSummaryHandler(blivap);
    const result = await handler.execute({
      actionName: 'get_wallet_summary',
      conversationId: '64b0000000000000000000c1',
      actor: user,
      params: { focus: 'balance' },
      context: emptyContext(),
    });
    expect(calls).toEqual([{ userId: user.userId, accessToken: 'token-a' }]);
    expect(result.message).toContain('NGN');
    expect(result.message).not.toContain('64b0000000000000000000bb');
  });

  it('does not accept another user id from parameters', async () => {
    const blivap = {
      getWalletSummary: async (ctx: { userId: string }) => {
        if (ctx.userId !== user.userId) {
          throw new ForbiddenException('wrong user');
        }
        return {
          availableKobo: 0,
          heldKobo: 0,
          payoutHeldKobo: 0,
          currency: 'NGN',
          entries: [],
        };
      },
    } as unknown as BlivapIntegrationPort;
    const handler = new GetWalletSummaryHandler(blivap);
    await expect(
      handler.execute({
        actionName: 'get_wallet_summary',
        conversationId: '64b0000000000000000000c1',
        actor: user,
        params: { userId: '64b0000000000000000000bb' },
        context: emptyContext(),
      }),
    ).resolves.toMatchObject({ status: 'success' });
  });
});
