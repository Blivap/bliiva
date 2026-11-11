import { describe, expect, it, vi } from 'vitest';
import {
  ConfirmWalletPayoutHandler,
  StartWalletPayoutHandler,
  StartWalletTopupHandler,
} from './wallet-extended.handlers.js';
import { ActionStatus } from '../actions.types.js';

const actor = {
  isAuthenticated: true,
  userId: '507f1f77bcf86cd799439011',
  accessToken: 'token',
  roles: ['user'],
};

const emptyContext = {
  currentIntent: null,
  pendingClarification: null,
  pendingActionName: null,
  pendingActionParams: {},
  conversationState: 'answered',
} as never;

describe('wallet extended handlers', () => {
  it('starts top-up and returns Paystack url', async () => {
    const blivap = {
      startWalletTopup: vi.fn(async () => ({
        reference: 'ref_12345678',
        authorizationUrl: 'https://paystack.test/pay',
        amountKobo: 500000,
      })),
    };
    const handler = new StartWalletTopupHandler(blivap as never, {
      get: () => 'https://app.blivap.com/wallet',
    } as never);
    const result = await handler.execute({
      actionName: 'start_wallet_topup',
      conversationId: 'c1',
      actor: actor as never,
      params: { amountNaira: '5000' },
      context: emptyContext,
    });
    expect(result.status).toBe(ActionStatus.Success);
    expect(result.message).toContain('https://paystack.test/pay');
    expect(result.resourceId).toBe('ref_12345678');
  });

  it('starts payout and asks for otp next', async () => {
    const blivap = {
      startWalletPayout: vi.fn(async () => ({
        id: 'payout1',
        reference: 'po_1',
        amountKobo: 100000,
        currency: 'NGN',
        status: 'pending_otp',
        bankName: 'Test Bank',
        accountName: 'Ada',
        accountLast4: '1234',
        failureReason: null,
        receiptAvailable: false,
      })),
    };
    const handler = new StartWalletPayoutHandler(blivap as never);
    const result = await handler.execute({
      actionName: 'start_wallet_payout',
      conversationId: 'c1',
      actor: actor as never,
      params: { amountNaira: '1000' },
      context: emptyContext,
    });
    expect(result.status).toBe(ActionStatus.Success);
    expect(result.data?.payoutId).toBe('payout1');
    expect(result.message.toLowerCase()).toContain('code');
  });

  it('confirms payout with otp without echoing it', async () => {
    const blivap = {
      confirmWalletPayout: vi.fn(async () => ({
        id: 'payout1',
        reference: 'po_1',
        amountKobo: 100000,
        currency: 'NGN',
        status: 'success',
        bankName: 'Test Bank',
        accountName: 'Ada',
        accountLast4: '1234',
        failureReason: null,
        receiptAvailable: true,
      })),
    };
    const handler = new ConfirmWalletPayoutHandler(blivap as never);
    const result = await handler.execute({
      actionName: 'confirm_wallet_payout',
      conversationId: 'c1',
      actor: actor as never,
      params: { payoutId: 'payout1', otp: 'AB12CD' },
      context: emptyContext,
    });
    expect(result.status).toBe(ActionStatus.Success);
    expect(result.message).not.toContain('AB12CD');
    expect(blivap.confirmWalletPayout).toHaveBeenCalledWith(
      expect.objectContaining({ userId: actor.userId }),
      'payout1',
      'AB12CD',
    );
  });
});
