import { describe, expect, it } from 'vitest';
import type { LlmToolDefinition } from './llm.types.js';
import { MAX_TOOLS_PER_TURN, selectTurnTools } from './select-turn-tools.js';

function tool(name: string): LlmToolDefinition {
  return {
    name,
    description: name,
    parameters: { type: 'object', properties: {}, required: [] },
  };
}

describe('selectTurnTools', () => {
  const catalog = [
    'get_wallet_summary',
    'list_payouts',
    'list_bank_accounts',
    'start_wallet_topup',
    'verify_wallet_topup',
    'get_profile',
    'get_donor_profile',
    'register_donor',
    'list_donors',
    'get_blood_requests',
  ].map(tool);

  it('returns at most three tools for the matching group', () => {
    const picked = selectTurnTools('What is my wallet balance?', catalog);
    expect(picked.length).toBeLessThanOrEqual(MAX_TOOLS_PER_TURN);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.map((item) => item.name)).toContain('get_wallet_summary');
    expect(picked.map((item) => item.name)).not.toContain('get_profile');
  });

  it('returns nothing when the message does not match an enabled tool', () => {
    expect(selectTurnTools('Tell me a joke', catalog)).toEqual([]);
  });
});
