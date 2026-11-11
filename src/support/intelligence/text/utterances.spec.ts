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
    'what are you',
    'what can you do',
    'how can you help',
    'hi are you and ai ?',
    'are you an AI?',
    'are you there',
    'bliiva are you there',
    'bliiva',
    'blivap',
    'you around',
    'still there?',
  ])('treats %j as a greeting', (raw) => {
    expect(detectUtterance(normalizeText(raw)).greeting).toBe(true);
  });

  it('flags capability asks as bot identity', () => {
    expect(
      detectUtterance(normalizeText('what can you do')).botIdentityAsk,
    ).toBe(true);
    expect(
      detectUtterance(normalizeText('what are you')).botIdentityAsk,
    ).toBe(true);
  });

  it('treats yes please as an affirmation', () => {
    const signals = detectUtterance(normalizeText('yes please'));
    expect(signals.affirmation).toBe(true);
    expect(signals.greeting).toBe(false);
  });

  it('does not treat support questions as greetings', () => {
    expect(
      detectUtterance(normalizeText('how are you eligible')).greeting,
    ).toBe(false);
  });

  it('strips a greeting prefix so the real question can be recognized', () => {
    const signals = detectUtterance(
      normalizeText('hello I forgot my password'),
    );
    expect(signals.greeting).toBe(false);
    expect(signals.greetingRemainder).toBe('i forgot my password');
  });
});

describe('detectUtterance affirmations and go-ahead', () => {
  it.each(['yes', 'yeah', 'yep', 'yup'])('treats %j as affirmation', (raw) => {
    const signals = detectUtterance(normalizeText(raw));
    expect(signals.affirmation).toBe(true);
    expect(signals.softAck).toBe(false);
    expect(signals.actionGoAhead).toBe(false);
  });

  it.each(['ok', 'okay', 'alright', 'sure', 'got it'])(
    'treats %j as soft ack',
    (raw) => {
      const signals = detectUtterance(normalizeText(raw));
      expect(signals.softAck).toBe(true);
      expect(signals.affirmation).toBe(false);
      expect(signals.actionGoAhead).toBe(false);
    },
  );

  it.each([
    'do it',
    'yes do it',
    'can you do it',
    'go ahead',
    'please do',
    'resend it',
  ])('treats %j as action go-ahead', (raw) => {
    const signals = detectUtterance(normalizeText(raw));
    expect(signals.actionGoAhead).toBe(true);
    expect(signals.softAck).toBe(false);
  });
});
