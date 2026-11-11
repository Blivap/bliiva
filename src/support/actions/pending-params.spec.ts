import { describe, expect, it } from 'vitest';
import { extractPendingActionParams } from './pending-params.js';

describe('extractPendingActionParams', () => {
  it('extracts payout OTP', () => {
    expect(
      extractPendingActionParams('confirm_wallet_payout', 'ab12cd', 'AB12CD'),
    ).toEqual({ otp: 'AB12CD' });
  });

  it('extracts top-up reference', () => {
    expect(
      extractPendingActionParams(
        'verify_wallet_topup',
        'ref_abc12345',
        'ref_abc12345',
      ),
    ).toEqual({ reference: 'ref_abc12345' });
  });

  it('extracts nin', () => {
    expect(
      extractPendingActionParams(
        'submit_nin_verification',
        '12345678901',
        '12345678901',
      ),
    ).toEqual({ nin: '12345678901' });
  });
});
