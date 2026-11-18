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
    expect(prompt).toContain(
      'NEVER say an action is done, completed, deleted, cancelled, or submitted unless a tool result in THIS turn confirms it.',
    );
    expect(prompt).toContain(
      'Answer any question you understand. Your name, who you are, greetings, and clear Blivap questions are understood: answer them.',
    );
    expect(prompt).toContain(
      'Then do not guess, assume, or answer a different question. Do not introduce yourself. Do not say "I\'m Bliiva" or "AI support assistant". Do not offer account, donations, bookings, or wallet.',
    );
    expect(prompt).toContain(
      'If it names no topic, ask them to say it more specifically.',
    );
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
