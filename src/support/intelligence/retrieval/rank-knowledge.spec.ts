import { describe, expect, it } from 'vitest';
import { KnowledgeStatus } from '../../../common/enums/index.js';
import { blivapKnowledge } from '../dataset/blivap-support.dataset.js';
import { resolveIntelligenceSettings } from '../intelligence-settings.js';
import type { KnowledgeEntry } from '../interfaces/knowledge-match.interface.js';
import { rankKnowledge } from './rank-knowledge.js';

const settings = resolveIntelligenceSettings();

describe('knowledge retrieval', () => {
  it('returns the published answer for the recognized intent', () => {
    const ranking = rankKnowledge({
      text: 'I forgot my password',
      entries: blivapKnowledge,
      intent: 'PASSWORD_RESET',
      category: 'account_authentication',
      settings,
    });
    expect(ranking.best?.title).toBe('How to reset your password');
    expect(ranking.best?.answer).toContain('Forgot password');
    expect(ranking.ambiguous).toBe(false);
  });

  it('returns no answer when nothing is relevant', () => {
    const ranking = rankKnowledge({
      text: 'what is the weather today',
      entries: blivapKnowledge,
      intent: null,
      category: null,
      settings,
    });
    expect(ranking.best).toBeNull();
  });

  it('excludes drafts and archived entries', () => {
    const draft: KnowledgeEntry = {
      ...blivapKnowledge[0],
      id: 'draft-secret',
      status: KnowledgeStatus.Draft,
      title: 'Unpublished password answer',
      answer: 'This draft must never be spoken.',
      priority: 100,
    };
    const ranking = rankKnowledge({
      text: 'I forgot my password',
      entries: [draft, ...blivapKnowledge],
      intent: 'PASSWORD_RESET',
      category: 'account_authentication',
      settings,
    });
    expect(ranking.matches.map((match) => match.knowledgeId)).not.toContain(
      'draft-secret',
    );
    expect(ranking.best?.answer).not.toContain('never be spoken');
  });

  it('asks for clarification when two published answers tie', () => {
    const first = blivapKnowledge.find(
      (entry) => entry.intent === 'ACCOUNT_LOGIN',
    );
    const second: KnowledgeEntry = {
      ...first!,
      id: 'kb-login-alt',
      title: 'Another sign-in article',
      answer: 'A different approved sign-in explanation.',
    };
    const ranking = rankKnowledge({
      text: 'I cannot login',
      entries: [first!, second],
      intent: 'ACCOUNT_LOGIN',
      category: 'account_authentication',
      settings,
    });
    expect(ranking.ambiguous).toBe(true);
    expect(ranking.best).toBeNull();
    expect(ranking.matches).toHaveLength(2);
  });

  it('does not prefer a different category that only shares a weak word', () => {
    const ranking = rankKnowledge({
      text: 'What is the status of my donation?',
      entries: blivapKnowledge,
      intent: 'DONATION_STATUS',
      category: 'blood_donation_process',
      settings,
    });
    expect(ranking.best?.intent).toBe('DONATION_STATUS');
    expect(ranking.best?.category).toBe('blood_donation_process');
  });

  it('uses the updated answer text after an entry changes', () => {
    const updated = blivapKnowledge.map((entry) =>
      entry.intent === 'PASSWORD_RESET'
        ? { ...entry, answer: 'Use the newest reset link from your email.' }
        : entry,
    );
    const ranking = rankKnowledge({
      text: 'reset my password',
      entries: updated,
      intent: 'PASSWORD_RESET',
      category: 'account_authentication',
      settings,
    });
    expect(ranking.best?.answer).toBe(
      'Use the newest reset link from your email.',
    );
  });
});
