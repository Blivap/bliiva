export interface KnowledgeChunkMetadata {
  documentId: string;
  title: string;
  category: string;
  language?: string;
  version: number;
  status: 'published' | 'archived';
  chunkIndex: number;
  createdAt: Date;
  source: 'knowledge' | 'submission';
  embeddingModel: string;
  embeddingDimensions: number;
  contentHash: string;
}

export interface VectorRecord {
  id: string;
  content: string;
  embedding: number[];
  metadata: KnowledgeChunkMetadata;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  title: string;
  category: string;
  language?: string;
  version: number;
  chunkIndex: number;
  content: string;
  score: number;
  embeddingModel: string;
}

export interface IngestibleDocument {
  documentId: string;
  title: string;
  category: string;
  language: string;
  version: number;
  status: 'published' | 'archived';
  text: string;
  source: 'knowledge' | 'submission';
}

export class DocumentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentRejectedError';
  }
}
