import { describe, expect, it } from 'vitest';
import {
  blivapIntents,
  recognitionExamples,
} from '../dataset/blivap-support.dataset.js';
import { resolveIntelligenceSettings } from '../intelligence-settings.js';
import { recognizeIntents } from './recognize-intents.js';

const settings = resolveIntelligenceSettings();

describe('intent recognition', () => {
  it.each(recognitionExamples)(
    'maps "$message" to $intent',
    ({ message, intent }) => {
      const result = recognizeIntents(message, blivapIntents, settings);
      expect(result.intent).toBe(intent);
    },
  );

  it('treats an exact login phrase as high confidence and unambiguous', () => {
    const result = recognizeIntents("I can't login.", blivapIntents, settings);
    expect(result.intent).toBe('ACCOUNT_LOGIN');
    expect(result.confidence).toBeGreaterThanOrEqual(
      settings.autoHandleMinConfidence,
    );
    expect(result.requiresClarification).toBe(false);
    expect(result.matchedPhrases.length).toBeGreaterThan(0);
  });

  it('keeps several account intents as alternatives for an ambiguous word', () => {
    const result = recognizeIntents('account', blivapIntents, settings);
    expect(result.intent).toBeNull();
    expect(result.requiresClarification).toBe(true);
    const names = result.alternatives.map((item) => item.intent);
    expect(names).toContain('ACCOUNT_LOGIN');
    expect(names).toContain('ACCOUNT_REGISTRATION');
  });

  it('does not classify a message with no support evidence', () => {
    const result = recognizeIntents(
      'what is the weather today',
      blivapIntents,
      settings,
    );
    expect(result.intent).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.alternatives).toEqual([]);
  });

  it('uses the active intent as context for a short follow-up', () => {
    const result = recognizeIntents(
      'it still does not work',
      blivapIntents,
      settings,
      {
        currentIntent: 'ACCOUNT_LOGIN',
        followUpCue: true,
      },
    );
    expect(result.intent).toBe('ACCOUNT_LOGIN');
    expect(result.confidence).toBeGreaterThan(
      result.alternatives[0]?.confidence ?? 0,
    );
  });

  it('ignores disabled intents', () => {
    const result = recognizeIntents(
      'I forgot my password',
      [
        {
          ...blivapIntents.find((item) => item.name === 'PASSWORD_RESET')!,
          enabled: false,
        },
      ],
      settings,
    );
    expect(result.intent).toBeNull();
  });
});
