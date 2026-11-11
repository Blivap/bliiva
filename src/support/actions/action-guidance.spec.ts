import { describe, expect, it } from 'vitest';
import { withActionGuidance } from './action-guidance.js';

describe('withActionGuidance', () => {
  it('appends a next-step tip after a successful wallet lookup', () => {
    const text = withActionGuidance(
      'get_wallet_summary',
      'Available: NGN 12.50',
      'success',
    );
    expect(text).toContain('Available: NGN 12.50');
    expect(text).toContain('Wallet');
  });

  it('asks the user to retry after a failed lookup without a fake yes-trap', () => {
    const text = withActionGuidance(
      'get_donations',
      'I couldn’t reach your Blivap account just now.',
      'failed',
    );
    expect(text).toContain('try again');
    expect(text.toLowerCase()).not.toContain('say yes');
  });
});
