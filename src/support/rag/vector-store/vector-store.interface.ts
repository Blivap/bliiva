import type { RetrievedChunk, VectorRecord } from '../rag.types.js';

export interface VectorQuery {
  embedding: number[];
  embeddingModel: string;
  topK: number;
  minScore: number;
  category?: string;
  maxCandidates: number;
}

export interface PublishedChunkFilter {
  category?: string;
  limit: number;
}

export interface StoredChunkEmbedding {
  contentHash: string;
  embeddingModel: string;
  embedding: number[];
}

export interface VectorStore {
  replaceDocument(documentId: string, records: VectorRecord[]): Promise<void>;
  markStatus(
    documentId: string,
    status: 'published' | 'archived',
  ): Promise<void>;
  listDocument(documentId: string): Promise<StoredChunkEmbedding[]>;
  search(query: VectorQuery): Promise<RetrievedChunk[]>;
  listPublished(filter: PublishedChunkFilter): Promise<RetrievedChunk[]>;
}
