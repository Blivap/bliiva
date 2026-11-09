import type { AiSettingsService } from '../../ai/ai-settings.service.js';
import { MongodbVectorStore } from './mongodb-vector-store.js';
import { QdrantVectorStore } from './qdrant-vector-store.js';
import type { VectorStore } from './vector-store.interface.js';

export const VECTOR_STORE = Symbol('VECTOR_STORE');

export function selectVectorStore(
  settings: AiSettingsService,
  mongodb: MongodbVectorStore,
  qdrant: QdrantVectorStore,
): VectorStore {
  const rag = settings.current().rag;
  if (rag.vectorStore === 'qdrant' && rag.qdrantUrl) return qdrant;
  return mongodb;
}
