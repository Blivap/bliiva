import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RetrievedChunk, VectorRecord } from '../rag.types.js';
import {
  SupportKnowledgeChunk,
  type SupportKnowledgeChunkDocument,
} from '../schemas/knowledge-chunk.schema.js';
import { rankByCosine, toRetrieved } from './similarity.js';
import type {
  PublishedChunkFilter,
  VectorQuery,
  VectorStore,
} from './vector-store.interface.js';

@Injectable()
export class MongodbVectorStore implements VectorStore {
  constructor(
    @InjectModel(SupportKnowledgeChunk.name)
    private readonly chunks: Model<SupportKnowledgeChunkDocument>,
  ) {}

  async replaceDocument(
    documentId: string,
    records: VectorRecord[],
  ): Promise<void> {
    await this.chunks.deleteMany({ documentId }).exec();
    if (records.length === 0) return;
    await this.chunks.insertMany(records.map(toDocument));
  }

  async markStatus(
    documentId: string,
    status: 'published' | 'archived',
  ): Promise<void> {
    await this.chunks.updateMany({ documentId }, { $set: { status } }).exec();
  }

  async listDocument(documentId: string) {
    const documents = await this.chunks.find({ documentId }).lean().exec();
    return documents.map((document) => ({
      contentHash: document.contentHash,
      embeddingModel: document.embeddingModel,
      embedding: document.embedding ?? [],
    }));
  }

  async search(query: VectorQuery): Promise<RetrievedChunk[]> {
    const filter: Record<string, unknown> = {
      status: 'published',
      embeddingModel: query.embeddingModel,
    };
    if (query.category) filter.category = query.category;
    const documents = await this.chunks
      .find(filter)
      .limit(query.maxCandidates)
      .lean()
      .exec();
    return rankByCosine(
      documents.map(fromDocument),
      query.embedding,
      query.embeddingModel,
      query.topK,
      query.minScore,
    );
  }

  async listPublished(filter: PublishedChunkFilter): Promise<RetrievedChunk[]> {
    const query: Record<string, unknown> = { status: 'published' };
    if (filter.category) query.category = filter.category;
    const documents = await this.chunks
      .find(query)
      .limit(filter.limit)
      .select('-embedding')
      .lean()
      .exec();
    return documents.map((document) =>
      toRetrieved(
        fromDocument(Object.assign({}, document, { embedding: [] })),
        0,
      ),
    );
  }
}

function toDocument(record: VectorRecord) {
  return {
    documentId: record.metadata.documentId,
    title: record.metadata.title,
    category: record.metadata.category,
    language: record.metadata.language ?? 'en',
    version: record.metadata.version,
    status: record.metadata.status,
    chunkIndex: record.metadata.chunkIndex,
    content: record.content,
    embedding: record.embedding,
    embeddingModel: record.metadata.embeddingModel,
    embeddingDimensions: record.metadata.embeddingDimensions,
    contentHash: record.metadata.contentHash,
    source: record.metadata.source,
  };
}

function fromDocument(
  document: Partial<SupportKnowledgeChunk> & { embedding?: number[] },
): VectorRecord {
  return {
    id: `${document.documentId}:${document.chunkIndex}`,
    content: document.content ?? '',
    embedding: document.embedding ?? [],
    metadata: {
      documentId: document.documentId ?? '',
      title: document.title ?? '',
      category: document.category ?? '',
      language: document.language,
      version: document.version ?? 1,
      status: document.status === 'archived' ? 'archived' : 'published',
      chunkIndex: document.chunkIndex ?? 0,
      createdAt: new Date(),
      source: document.source === 'submission' ? 'submission' : 'knowledge',
      embeddingModel: document.embeddingModel ?? '',
      embeddingDimensions: document.embeddingDimensions ?? 0,
      contentHash: document.contentHash ?? '',
    },
  };
}
