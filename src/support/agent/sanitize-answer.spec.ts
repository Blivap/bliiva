import { describe, expect, it } from 'vitest';
import {
  isEchoOfUser,
  looksLikeLeakedReasoning,
  sanitizeAnswer,
} from './sanitize-answer.js';

const SONG_LEAK = `Okay, let's start by understanding what the customer is asking for. They said, "anything at all just come up with something." This is a bit vague, but I'll take it as a request for a simple, friendly response.

Since the customer is asking for something to "come up with," I'll generate a simple, warm reply that acknowledges their request and offers assistance. I'll keep it short and friendly, avoiding any technical jargon or complex language.

I'll also ensure that the response is in line with the tone and style specified, and I'll avoid any unnecessary information or tools. If the customer has any further questions or needs assistance, I'll be here to help.

So, the final reply will be a simple, friendly message that acknowledges the request and offers assistance, keeping it short and to the point.

Alright, let's start by understanding what the customer is asking for. They said, "anything at all just come up with something." This is a bit`;

describe('sanitizeAnswer', () => {
  it('drops the exact planning leak that used to ship in chat', () => {
    expect(sanitizeAnswer(SONG_LEAK)).toBe('');
    expect(looksLikeLeakedReasoning(SONG_LEAK)).toBe(true);
  });

  it('strips think tags and keeps a real reply', () => {
    expect(
      sanitizeAnswer(
        '<think>plan the wallet answer</think>\nYour balance is NGN 12.50.',
      ),
    ).toBe('Your balance is NGN 12.50.');
  });

  it('keeps a normal customer-facing reply', () => {
    expect(
      sanitizeAnswer(
        'I’m Bliiva — Blivap’s AI support assistant. How can I help with your account today?',
      ),
    ).toContain('Bliiva');
  });

  it('keeps a real reply when planning was only a separate paragraph', () => {
    const mixed = [
      'Okay, let’s see. The customer said “yes please.” I need to reply in a warm tone.',
      'Sounds good — I’m here if you need anything on Blivap.',
    ].join('\n\n');
    expect(sanitizeAnswer(mixed)).toBe(
      'Sounds good — I’m here if you need anything on Blivap.',
    );
  });

  it('rejects pure echo of the user message', () => {
    expect(sanitizeAnswer('That is a lie.', 'that is a lie')).toBe('');
    expect(
      sanitizeAnswer(
        "Why do you repeat what I'm saying?\nI’m here to help! Let me know how I can assist you.",
        'why do you repeat what i am saying',
      ),
    ).toBe('');
  });

  it('does not treat a helpful answer that quotes the topic as an echo', () => {
    expect(
      sanitizeAnswer(
        'Blivap connects donors, hospitals, and blood requests across Nigeria.',
        'what is blivap',
      ),
    ).toContain('Blivap');
  });
});

describe('isEchoOfUser', () => {
  it('detects verbatim repeats', () => {
    expect(isEchoOfUser('That is a lie', 'That is a lie.')).toBe(true);
  });
});
