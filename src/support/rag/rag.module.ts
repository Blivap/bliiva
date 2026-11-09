import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { EmbeddingService } from './embeddings/embedding.service.js';
import { OllamaEmbeddingProvider } from './embeddings/ollama-embedding.provider.js';
import { EMBEDDING_PROVIDER } from './embeddings/embedding.interface.js';
import { ChunkingService } from './ingestion/chunking.service.js';
import { DocumentIngestionService } from './ingestion/document-ingestion.service.js';
import { DocumentParserService } from './ingestion/document-parser.service.js';
import { KNOWLEDGE_INDEXER } from './knowledge-indexer.js';
import { RagAdminController } from './rag.admin.controller.js';
import { RagService } from './rag.service.js';
import { RetrievalService } from './retrieval/retrieval.service.js';
import {
  SupportKnowledgeChunk,
  SupportKnowledgeChunkSchema,
} from './schemas/knowledge-chunk.schema.js';
import { MongodbVectorStore } from './vector-store/mongodb-vector-store.js';
import { QdrantVectorStore } from './vector-store/qdrant-vector-store.js';
import {
  selectVectorStore,
  VECTOR_STORE,
} from './vector-store/vector-store.factory.js';
import { AiSettingsService } from '../ai/ai-settings.service.js';

@Module({
  imports: [
    AiModule,
    KnowledgeModule,
    MongooseModule.forFeature([
      { name: SupportKnowledgeChunk.name, schema: SupportKnowledgeChunkSchema },
    ]),
  ],
  controllers: [RagAdminController],
  providers: [
    OllamaEmbeddingProvider,
    {
      provide: EMBEDDING_PROVIDER,
      useExisting: OllamaEmbeddingProvider,
    },
    EmbeddingService,
    ChunkingService,
    DocumentParserService,
    MongodbVectorStore,
    QdrantVectorStore,
    {
      provide: VECTOR_STORE,
      useFactory: selectVectorStore,
      inject: [AiSettingsService, MongodbVectorStore, QdrantVectorStore],
    },
    RetrievalService,
    RagService,
    DocumentIngestionService,
    {
      provide: KNOWLEDGE_INDEXER,
      useExisting: DocumentIngestionService,
    },
  ],
  exports: [
    RagService,
    DocumentIngestionService,
    RetrievalService,
    KNOWLEDGE_INDEXER,
    VECTOR_STORE,
  ],
})
export class RagModule {}
