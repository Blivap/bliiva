import { describe, expect, it } from 'vitest';
import { normalizeText } from '../text/text-normalizer.js';
import { detectUtterance } from '../text/utterances.js';
import {
  botOfferedAction,
  inferImmediateLiveDataAction,
  inferOfferedAction,
  isGoAhead,
  pendingFromBotOffer,
} from './offered-action.js';
import { emptyContext, resolvePendingReply } from './conversation-context.js';

describe('offered action go-ahead', () => {
  it('detects balance and booking offers from bot copy', () => {
    expect(
      botOfferedAction(
        'Your balance is available. Want me to show it to you?',
      ),
    ).toBe(true);
    expect(
      botOfferedAction("Ok. Let's check your bookings. Want me to show it to you?"),
    ).toBe(true);
    expect(botOfferedAction('Anything else?')).toBe(false);
  });

  it('infers wallet and donation actions from the offer', () => {
    expect(
      inferOfferedAction({
        lastBotResponse:
          'Your balance is available. Want me to show it to you?',
      }),
    ).toMatchObject({ actionName: 'get_wallet_summary' });

    expect(
      inferOfferedAction({
        lastBotResponse:
          "Ok. Let's check your bookings. Want me to show it to you?",
      }),
    ).toMatchObject({ actionName: 'get_donations' });
  });

  it('treats yes after an offer as affirm, not follow-up more-help', () => {
    const state = {
      ...emptyContext(),
      currentIntent: 'WALLET_BALANCE',
      lastBotResponse:
        'Your balance is available. Want me to show it to you?',
      pendingClarification: {
        kind: 'follow_up' as const,
        question: 'Anything else?',
        options: [
          { intent: 'WALLET_BALANCE', label: 'yes' },
          { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
        ],
      },
    };
    const yes = normalizeText('yes');
    expect(resolvePendingReply(state, yes, detectUtterance(yes)).type).toBe(
      'affirm',
    );
    expect(isGoAhead(detectUtterance(yes), yes)).toBe(true);
  });

  it('treats yes as go-ahead when the prior user ask was for balance', () => {
    const state = {
      ...emptyContext(),
      lastUserMessage: 'i want to see my balance',
      lastBotResponse:
        'Okay, check the wallet icon in the app. Let me know if you need help.',
      pendingClarification: {
        kind: 'follow_up' as const,
        question: 'Anything else?',
        options: [
          { intent: 'GENERAL_ENQUIRY', label: 'yes' },
          { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
        ],
      },
    };
    const yes = normalizeText('yes');
    expect(resolvePendingReply(state, yes, detectUtterance(yes)).type).toBe(
      'affirm',
    );
    expect(
      inferOfferedAction({ lastUserMessage: state.lastUserMessage })
        ?.actionName,
    ).toBe('get_wallet_summary');
  });

  it('builds an action_offer pending from bot offer text', () => {
    const pending = pendingFromBotOffer({
      botContent: 'Your balance is available. Want me to show it to you?',
      currentIntent: 'WALLET_BALANCE',
    });
    expect(pending?.kind).toBe('action_offer');
    expect(pending?.actionName).toBe('get_wallet_summary');
  });

  it('maps clear balance asks to an immediate wallet lookup', () => {
    expect(
      inferImmediateLiveDataAction('i want to know my balance'),
    ).toMatchObject({
      actionName: 'get_wallet_summary',
      params: { focus: 'balance' },
    });
    expect(
      inferImmediateLiveDataAction('show my bookings'),
    ).toMatchObject({ actionName: 'get_donations' });
    expect(
      inferImmediateLiveDataAction('do i have unread notifications?'),
    ).toMatchObject({ actionName: 'list_notifications' });
    expect(inferImmediateLiveDataAction('show my bank accounts')).toMatchObject({
      actionName: 'list_bank_accounts',
    });
    expect(inferImmediateLiveDataAction('list my payouts')).toMatchObject({
      actionName: 'list_payouts',
    });
    expect(
      inferImmediateLiveDataAction('give me list of O+ donors'),
    ).toMatchObject({
      actionName: 'list_donors',
      params: { bloodType: 'O+' },
    });
    expect(inferImmediateLiveDataAction('hi')).toBeNull();
    expect(
      inferImmediateLiveDataAction('how can i withdraw my money'),
    ).toBeNull();
  });

  it('detects shown-below and do-you-want offer copy', () => {
    expect(
      botOfferedAction('Your balance is shown below. Want me to show it?'),
    ).toBe(true);
    expect(
      botOfferedAction('Do you want to check your unread notifications?'),
    ).toBe(true);
  });
});
