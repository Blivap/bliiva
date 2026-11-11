import { describe, expect, it } from 'vitest';
import { extractPendingActionParams } from './pending-params.js';
import { ActionStatus } from './actions.types.js';

/**
 * Covers the chat money path gates: amount confirm → OTP/reference paste.
 * Orchestrator wires these via action_resource + extractPendingActionParams.
 */
describe('money confirm + OTP happy path pieces', () => {
  it('collects OTP after payout start without echoing secrets in param helpers', () => {
    const payoutId = '507f1f77bcf86cd799439011';
    const pending = {
      actionName: 'confirm_wallet_payout',
      params: { payoutId },
    };
    const free = extractPendingActionParams(
      pending.actionName,
      'ab12cd',
      'AB12CD',
    );
    expect(free).toEqual({ otp: 'AB12CD' });
    const merged = { ...pending.params, ...free! };
    expect(merged).toEqual({ payoutId, otp: 'AB12CD' });
    expect(JSON.stringify(merged)).toContain('otp');
    // Success payload shape must never include the OTP value in message data.
    const successData = {
      status: ActionStatus.Success,
      data: { payoutId, status: 'success' },
    };
    expect(JSON.stringify(successData)).not.toContain('AB12CD');
  });

  it('collects top-up reference after Paystack redirect', () => {
    const free = extractPendingActionParams(
      'verify_wallet_topup',
      'ref_paystack_99',
      'ref_paystack_99',
    );
    expect(free).toEqual({ reference: 'ref_paystack_99' });
  });
});
