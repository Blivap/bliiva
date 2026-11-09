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

  it('treats yes after an answer as confirmation, isolated from another conversation', () => {
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
      resolvePendingReply(answered, 'yes', detectUtterance('yes')).type,
    ).toBe('affirm');
    expect(resolvePendingReply(other, 'yes', detectUtterance('yes')).type).toBe(
      'none',
    );
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
