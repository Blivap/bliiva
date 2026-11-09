import { describe, expect, it } from 'vitest';
import { hybridRank, keywordScore, sharesGrounding } from './hybrid-rank.js';

const chunk = (
  id: string,
  score: number,
  content = 'register as a donor on Blivap',
) => ({
  id,
  documentId: `doc-${id}`,
  title: 'Donor registration',
  category: 'donor_registration',
  version: 1,
  chunkIndex: 0,
  content,
  score,
  embeddingModel: 'nomic-embed-text',
});

describe('hybrid ranking', () => {
  it('keeps keyword hits even when semantic score is low', () => {
    const ranked = hybridRank({
      semantic: [chunk('a', 0.2)],
      keyword: [chunk('a', 0.9), chunk('b', 0.8, 'wallet balance guide')],
      semanticWeight: 0.7,
      topK: 5,
      minScore: 0.55,
    });
    expect(ranked.map((item) => item.id)).toContain('b');
  });

  it('scores keyword overlap', () => {
    expect(
      keywordScore(
        'how do I register as a donor',
        'Register as a donor from the Blivap profile page.',
      ),
    ).toBeGreaterThan(0.4);
  });

  it('detects weak grounding', () => {
    expect(
      sharesGrounding('Cats orbit Mars every Thursday.', [
        'Register as a donor from Settings.',
      ]),
    ).toBe(false);
  });
});
