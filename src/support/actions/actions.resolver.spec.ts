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

  it('blocks unsupported peer transfers', () => {
    expect(
      resolver.resolve({
        intent: 'WALLET_BALANCE',
        message: 'Transfer money from my wallet',
      }),
    ).toEqual({ unsupported: 'wallet_mutation_unsupported' });

    expect(
      resolver.resolve({
        intent: null,
        message: 'can you make a transfer from my balance?',
      }),
    ).toEqual({ unsupported: 'wallet_mutation_unsupported' });
  });

  it('routes clear withdraw asks to start_wallet_payout', () => {
    expect(
      resolver.resolve({
        intent: null,
        message: 'withdraw 5000 from my wallet',
      }),
    ).toMatchObject({
      action: { name: 'start_wallet_payout' },
      params: { amountNaira: '5000' },
    });
  });

  it('keeps withdraw how-to questions on the knowledge path', () => {
    expect(
      resolver.resolve({
        intent: null,
        message: 'please how can i withdraw my money',
      }),
    ).toBeNull();
  });

  it('runs bank account list immediately for a clear ask', () => {
    expect(
      resolver.resolve({
        intent: null,
        message: 'show my bank accounts',
      }),
    ).toMatchObject({ action: { name: 'list_bank_accounts' } });
  });

  it('lists donors by blood type for a clear browse ask', () => {
    expect(
      resolver.resolve({
        intent: null,
        message: 'give me list of O+ donors',
      }),
    ).toMatchObject({
      action: { name: 'list_donors' },
      params: { bloodType: 'O+' },
    });
  });

  it('maps do-it / resend cues on account intents to email verification resend', () => {
    expect(
      resolver.resolve({
        intent: 'ACCOUNT_STATUS',
        message: 'yes do it',
      }),
    ).toMatchObject({ action: { name: 'resend_email_verification' } });

    expect(
      resolver.resolve({
        intent: 'ACCOUNT_LOGIN',
        message: 'can you do it',
      }),
    ).toMatchObject({ action: { name: 'resend_email_verification' } });

    expect(
      resolver.resolve({
        intent: null,
        message: 'do it',
        lastBotResponse:
          'You can verify your account by checking email verification status. Want me to help?',
      }),
    ).toMatchObject({ action: { name: 'resend_email_verification' } });
  });

  it('runs wallet lookup when user says yes after a balance offer', () => {
    expect(
      resolver.resolve({
        intent: null,
        message: 'yes',
        userGoAhead: true,
        lastBotResponse:
          'Your balance is available. Want me to show it to you?',
      }),
    ).toMatchObject({
      action: { name: 'get_wallet_summary' },
      params: { focus: 'balance' },
    });
  });

  it('runs wallet lookup immediately for a clear balance ask', () => {
    expect(
      resolver.resolve({
        intent: null,
        message: 'i want to know my balance',
      }),
    ).toMatchObject({
      action: { name: 'get_wallet_summary' },
      params: { focus: 'balance' },
    });
  });

  it('keeps verification how-to on the knowledge path', () => {
    expect(
      resolver.resolve({
        intent: 'ACCOUNT_STATUS',
        message: 'how can i verify my account',
      }),
    ).toBeNull();
  });
});
