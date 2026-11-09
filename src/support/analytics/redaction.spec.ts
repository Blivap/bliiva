import { describe, expect, it } from 'vitest';
import { redactForAnalytics } from './redaction.js';

describe('analytics redaction', () => {
  it('drops medical details and contact data from stored excerpts', () => {
    expect(redactForAnalytics('I have hepatitis and need help')).toBeNull();
    expect(
      redactForAnalytics('email me at donor@example.com about my password'),
    ).toBe('email me at [email] about my password');
    expect(redactForAnalytics('chest pain', { forceRedact: true })).toBeNull();
  });
});
