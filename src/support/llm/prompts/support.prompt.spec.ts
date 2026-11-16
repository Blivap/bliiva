import { describe, expect, it } from 'vitest';
import { buildSupportTurn, NO_RELIABLE_ANSWER } from './support.prompt.js';

describe('buildSupportTurn', () => {
  it('grounds replies on supplied notes and the provided tools', () => {
    const prompt = buildSupportTurn('How do I register as a donor?', [
      {
        title: 'Donor registration',
        category: 'donor_registration',
        version: 2,
        content: 'Open Profile and complete the donor form.',
      },
    ]);
    expect(prompt).toContain(
      'Answer ONLY from the KNOWLEDGE NOTES block supplied below and from tool results.',
    );
    expect(prompt).toContain('KNOWLEDGE NOTES');
    expect(prompt).toContain('Donor registration');
    expect(prompt).toContain('Open Profile and complete the donor form.');
    expect(prompt).toContain('the provided tools');
    expect(prompt).not.toContain('search_knowledge');
    expect(prompt).not.toContain('get_donor_profile');
    expect(prompt).toContain('How do I register as a donor?');
  });

  it('says when no notes were retrieved', () => {
    const prompt = buildSupportTurn('What is the fee?');
    expect(prompt).toContain('KNOWLEDGE NOTES');
    expect(prompt).toContain('None retrieved for this turn.');
  });

  it('keeps the fixed fallback wording', () => {
    expect(NO_RELIABLE_ANSWER).toContain('support@blivap.com');
    expect(NO_RELIABLE_ANSWER).toContain('care@blivap.com');
    expect(NO_RELIABLE_ANSWER).toContain('support ticket');
  });
});
