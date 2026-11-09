import { describe, expect, it, vi } from 'vitest';
import type { AiSettingsService } from '../../ai/ai-settings.service.js';
import type { EmbeddingService } from '../embeddings/embedding.service.js';
import type { RetrievedChunk } from '../rag.types.js';
import type { VectorStore } from '../vector-store/vector-store.interface.js';
import { RetrievalService } from './retrieval.service.js';

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    title: 'Donor registration',
    category: 'donor_registration',
    version: 1,
    chunkIndex: 0,
    content: 'Complete donor registration in the Blivap app.',
    score: 0,
    embeddingModel: 'nomic-embed-text',
    ...overrides,
  };
}

function settings() {
  return {
    current: () => ({
      rag: {
        enabled: true,
        topK: 5,
        minRelevanceScore: 0.3,
        maxCandidates: 20,
        semanticWeight: 0.7,
      },
    }),
  } as AiSettingsService;
}

describe('RetrievalService', () => {
  it('returns a relevant published chunk', async () => {
    const store: VectorStore = {
      replaceDocument: vi.fn(),
      markStatus: vi.fn(),
      listDocument: vi.fn(),
      listPublished: vi.fn(async () => [chunk()]),
      search: vi.fn(async () => [chunk({ score: 0.9 })]),
    };
    const embeddings = {
      model: 'nomic-embed-text',
      embed: vi.fn(async () => [[1, 0]]),
    } as unknown as EmbeddingService;
    const service = new RetrievalService(settings(), embeddings, store);
    const hit = await service.retrieve({ text: 'donor registration' });
    expect(hit.failed).toBe(false);
    expect(hit.semanticAvailable).toBe(true);
    expect(hit.chunks[0]?.documentId).toBe('doc-1');
  });

  it('returns nothing for an unrelated question', async () => {
    const store: VectorStore = {
      replaceDocument: vi.fn(),
      markStatus: vi.fn(),
      listDocument: vi.fn(),
      listPublished: vi.fn(async () => [chunk()]),
      search: vi.fn(async () => []),
    };
    const embeddings = {
      model: 'nomic-embed-text',
      embed: vi.fn(async () => [[1, 0]]),
    } as unknown as EmbeddingService;
    const service = new RetrievalService(settings(), embeddings, store);
    const hit = await service.retrieve({ text: 'weather forecast tomorrow' });
    expect(hit.chunks).toEqual([]);
  });

  it('falls back to keywords when embeddings fail', async () => {
    const store: VectorStore = {
      replaceDocument: vi.fn(),
      markStatus: vi.fn(),
      listDocument: vi.fn(),
      listPublished: vi.fn(async () => [chunk()]),
      search: vi.fn(),
    };
    const embeddings = {
      model: 'nomic-embed-text',
      embed: vi.fn(async () => {
        throw new Error('embed down');
      }),
    } as unknown as EmbeddingService;
    const service = new RetrievalService(settings(), embeddings, store);
    const hit = await service.retrieve({ text: 'donor registration' });
    expect(hit.semanticAvailable).toBe(false);
    expect(hit.chunks).toHaveLength(1);
    expect(store.search).not.toHaveBeenCalled();
  });

  it('flags an embedding model mismatch when semantic search is empty', async () => {
    const store: VectorStore = {
      replaceDocument: vi.fn(),
      markStatus: vi.fn(),
      listDocument: vi.fn(),
      listPublished: vi.fn(async () => [
        chunk({
          embeddingModel: 'old-model',
          title: 'Hospital hours',
          content: 'Visiting hours are posted at reception.',
        }),
      ]),
      search: vi.fn(async () => []),
    };
    const embeddings = {
      model: 'nomic-embed-text',
      embed: vi.fn(async () => [[1, 0]]),
    } as unknown as EmbeddingService;
    const service = new RetrievalService(settings(), embeddings, store);
    const hit = await service.retrieve({ text: 'donor registration' });
    expect(hit.embeddingMismatch).toBe(true);
    expect(hit.chunks).toEqual([]);
  });

  it('reports retrieval failure without throwing', async () => {
    const store: VectorStore = {
      replaceDocument: vi.fn(),
      markStatus: vi.fn(),
      listDocument: vi.fn(),
      listPublished: vi.fn(async () => {
        throw new Error('mongo down');
      }),
      search: vi.fn(),
    };
    const embeddings = {
      model: 'nomic-embed-text',
      embed: vi.fn(),
    } as unknown as EmbeddingService;
    const service = new RetrievalService(settings(), embeddings, store);
    const hit = await service.retrieve({ text: 'donor registration' });
    expect(hit.failed).toBe(true);
    expect(hit.chunks).toEqual([]);
  });
});
