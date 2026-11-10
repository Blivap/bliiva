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

  it('suggests retrying or a specialist only after a failed lookup', () => {
    const text = withActionGuidance(
      'get_donations',
      'I couldn’t reach your Blivap account just now.',
      'failed',
    );
    expect(text).toContain('keeps failing');
    expect(text).toContain('specialist');
  });
});
