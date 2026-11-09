import { describe, expect, it } from 'vitest';
import { ActionsRegistry } from './actions.registry.js';
import { ActionsResolver } from './actions.resolver.js';

describe('actions resolver', () => {
  const resolver = new ActionsResolver(new ActionsRegistry());

  it('maps wallet and blood-request status questions to read actions', () => {
    expect(
      resolver.resolve({
        intent: 'WALLET_BALANCE',
        message: 'How much do I have in my wallet?',
      }),
    ).toMatchObject({
      action: { name: 'get_wallet_summary' },
      params: { focus: 'balance' },
    });

    expect(
      resolver.resolve({
        intent: 'BLOOD_REQUEST_STATUS',
        message: "What's the status of my blood request?",
      }),
    ).toMatchObject({
      action: { name: 'get_blood_requests' },
    });
  });

  it('keeps general how-to questions on the knowledge path', () => {
    expect(
      resolver.resolve({
        intent: 'BLOOD_REQUEST_HELP',
        message: 'How do I make a blood request?',
      }),
    ).toBeNull();
  });

  it('blocks unsupported financial mutations', () => {
    expect(
      resolver.resolve({
        intent: 'WALLET_BALANCE',
        message: 'Transfer money from my wallet',
      }),
    ).toEqual({ unsupported: 'wallet_mutation_unsupported' });
  });
});
