import { describe, expect, it } from 'vitest';
import {
  emptyContext,
  readContext,
  resolvePendingReply,
} from './conversation-context.js';
import { detectUtterance } from '../text/utterances.js';
import { normalizeText } from '../text/text-normalizer.js';

describe('conversation context', () => {
  it('resolves a short clarification answer to the offered option', () => {
    const state = {
      ...emptyContext(),
      conversationState: 'clarifying' as const,
      pendingClarification: {
        kind: 'intent' as const,
        question: 'Are you having trouble logging in or creating an account?',
        options: [
          { intent: 'ACCOUNT_LOGIN', label: 'logging in' },
          { intent: 'ACCOUNT_REGISTRATION', label: 'creating an account' },
        ],
      },
    };
    const normalized = normalizeText('Logging in.');
    const resolution = resolvePendingReply(
      state,
      normalized,
      detectUtterance(normalized),
    );
    expect(resolution).toEqual({
      type: 'select',
      option: { intent: 'ACCOUNT_LOGIN', label: 'logging in' },
    });
  });

  it('treats soft acks after an answer as done, and yes as more help', () => {
    const answered = {
      ...emptyContext(),
      currentIntent: 'PASSWORD_RESET',
      conversationState: 'answered' as const,
      pendingClarification: {
        kind: 'follow_up' as const,
        question: 'Anything else?',
        options: [
          { intent: 'PASSWORD_RESET', label: 'yes' },
          { intent: 'REQUEST_HUMAN', label: 'no I need more help' },
        ],
      },
    };
    const other = emptyContext();
    expect(
      resolvePendingReply(
        answered,
        'alright',
        detectUtterance(normalizeText('alright')),
      ).type,
    ).toBe('affirm');
    expect(
      resolvePendingReply(answered, 'yes', detectUtterance('yes')).type,
    ).toBe('reject');
    expect(
      resolvePendingReply(
        answered,
        'do it',
        detectUtterance(normalizeText('do it')),
      ).type,
    ).toBe('none');
    expect(resolvePendingReply(other, 'yes', detectUtterance('yes')).type).toBe(
      'none',
    );
  });

  it('treats alright and do it as affirmations for action confirmation', () => {
    const confirming = {
      ...emptyContext(),
      currentIntent: 'ACCOUNT_STATUS',
      pendingClarification: {
        kind: 'action_confirm' as const,
        question: 'Resend the verification email?',
        options: [
          { intent: 'ACCOUNT_STATUS', label: 'yes' },
          { intent: 'ACCOUNT_STATUS', label: 'no' },
        ],
        actionName: 'resend_email_verification',
      },
    };
    expect(
      resolvePendingReply(
        confirming,
        'alright',
        detectUtterance(normalizeText('alright')),
      ).type,
    ).toBe('affirm');
    expect(
      resolvePendingReply(
        confirming,
        'yes do it',
        detectUtterance(normalizeText('yes do it')),
      ).type,
    ).toBe('affirm');
  });

  it('reads a stored context without trusting unknown fields', () => {
    const state = readContext({
      currentIntent: 'ACCOUNT_LOGIN',
      unsuccessfulAttempts: 1,
      ignored: 'nope',
    });
    expect(state.currentIntent).toBe('ACCOUNT_LOGIN');
    expect(state.unsuccessfulAttempts).toBe(1);
    expect(state.pendingClarification).toBeNull();
  });
});
