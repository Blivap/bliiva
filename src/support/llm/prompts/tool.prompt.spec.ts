import { describe, expect, it } from 'vitest';
import { buildToolPrompt } from './tool.prompt.js';

describe('buildToolPrompt', () => {
  it('refers to the provided tools without naming them', () => {
    const prompt = buildToolPrompt();
    expect(prompt).toContain('the provided tools');
    expect(prompt).toContain('At most three tools');
    for (const name of [
      'get_profile',
      'get_wallet_summary',
      'cancel_booking',
      'get_blood_requests',
      'submit_nin_verification',
    ]) {
      expect(prompt).not.toContain(name);
    }
  });
});
