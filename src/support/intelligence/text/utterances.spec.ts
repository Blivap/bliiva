import { describe, expect, it } from 'vitest';
import { normalizeText } from './text-normalizer.js';
import { detectUtterance } from './utterances.js';

describe('detectUtterance greeting', () => {
  it.each([
    'hi',
    'hello',
    'hey',
    'how are you',
    'How are you?',
    "how's it going",
    "what's up",
    "hello what's your name",
    'hi who are you',
    'hi are you and ai ?',
    'are you an AI?',
  ])('treats %j as a greeting', (raw) => {
    expect(detectUtterance(normalizeText(raw)).greeting).toBe(true);
  });

  it('does not treat support questions as greetings', () => {
    expect(detectUtterance(normalizeText('how are you eligible')).greeting).toBe(
      false,
    );
  });

  it('strips a greeting prefix so the real question can be recognized', () => {
    const signals = detectUtterance(
      normalizeText('hello I forgot my password'),
    );
    expect(signals.greeting).toBe(false);
    expect(signals.greetingRemainder).toBe('i forgot my password');
  });
});
