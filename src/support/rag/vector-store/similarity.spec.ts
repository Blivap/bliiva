import { describe, expect, it } from 'vitest';
import type { VectorRecord } from '../rag.types.js';
import { rankByCosine } from './similarity.js';

function record(
  status: 'published' | 'archived',
  embeddingModel: string,
  embedding: number[],
): VectorRecord {
  return {
    id: `${status}-${embeddingModel}`,
    content: 'donor registration steps',
    embedding,
    metadata: {
      documentId: 'doc-1',
      title: 'Donor registration',
      category: 'donor_registration',
      version: 1,
      status,
      chunkIndex: 0,
      createdAt: new Date('2026-01-01'),
      source: 'knowledge',
      embeddingModel,
      embeddingDimensions: embedding.length,
      contentHash: 'abc',
    },
  };
}

describe('rankByCosine', () => {
  const query = [1, 0];

  it('keeps published chunks from the active embedding model', () => {
    const ranked = rankByCosine(
      [record('published', 'nomic-embed-text', [1, 0])],
      query,
      'nomic-embed-text',
      5,
      0.5,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.score).toBe(1);
  });

  it('excludes archived chunks, other models, and mismatched dimensions', () => {
    const ranked = rankByCosine(
      [
        record('archived', 'nomic-embed-text', [1, 0]),
        record('published', 'other-model', [1, 0]),
        record('published', 'nomic-embed-text', [1, 0, 0]),
      ],
      query,
      'nomic-embed-text',
      5,
      0,
    );
    expect(ranked).toEqual([]);
  });
});
