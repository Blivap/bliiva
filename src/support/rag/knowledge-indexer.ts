export const KNOWLEDGE_INDEXER = Symbol('KNOWLEDGE_INDEXER');

export interface KnowledgeIndexer {
  syncDocument(id: string): Promise<void>;
}
