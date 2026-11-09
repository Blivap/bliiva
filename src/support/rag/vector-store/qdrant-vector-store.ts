import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsService } from '../../ai/ai-settings.service.js';
import { LlmError } from '../../llm/llm.types.js';
import type { RetrievedChunk, VectorRecord } from '../rag.types.js';
import { toRetrieved } from './similarity.js';
import type {
  PublishedChunkFilter,
  VectorQuery,
  VectorStore,
} from './vector-store.interface.js';

/**
 * Optional Qdrant adapter. It is not selected unless VECTOR_STORE=qdrant and
 * QDRANT_URL are both set, so local development stays on MongoDB.
 */
@Injectable()
export class QdrantVectorStore implements VectorStore {
  private readonly logger = new Logger(QdrantVectorStore.name);
  private ensuredDimensions = 0;

  constructor(private readonly settings: AiSettingsService) {}

  async replaceDocument(
    documentId: string,
    records: VectorRecord[],
  ): Promise<void> {
    const base = this.requireUrl();
    await this.ensureCollection(records[0]?.embedding.length ?? 0);
    await this.deleteByDocument(documentId);
    if (records.length === 0) return;
    const response = await fetch(
      `${base}/collections/${this.collection()}/points`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          points: records.map((record) => ({
            id: pointId(record.id),
            vector: record.embedding,
            payload: {
              ...record.metadata,
              content: record.content,
              recordId: record.id,
            },
          })),
        }),
      },
    );
    if (!response.ok) {
      throw new LlmError(
        'Qdrant rejected the knowledge upsert.',
        'vector_store',
      );
    }
  }

  async markStatus(
    documentId: string,
    status: 'published' | 'archived',
  ): Promise<void> {
    const base = this.requireUrl();
    const response = await fetch(
      `${base}/collections/${this.collection()}/points/payload`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          payload: { status },
          filter: {
            must: [{ key: 'documentId', match: { value: documentId } }],
          },
        }),
      },
    );
    if (!response.ok) {
      throw new LlmError(
        'Qdrant could not update chunk status.',
        'vector_store',
      );
    }
  }

  async listDocument(documentId: string) {
    const published = await this.listPublished({ limit: 200 });
    return published
      .filter((chunk) => chunk.documentId === documentId)
      .map((chunk) => ({
        contentHash: '',
        embeddingModel: chunk.embeddingModel,
        embedding: [] as number[],
      }));
  }

  async search(query: VectorQuery): Promise<RetrievedChunk[]> {
    const base = this.requireUrl();
    const must: Array<Record<string, unknown>> = [
      { key: 'status', match: { value: 'published' } },
      { key: 'embeddingModel', match: { value: query.embeddingModel } },
    ];
    if (query.category) {
      must.push({ key: 'category', match: { value: query.category } });
    }
    const response = await fetch(
      `${base}/collections/${this.collection()}/points/query`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: query.embedding,
          limit: query.topK,
          score_threshold: query.minScore,
          filter: { must },
          with_payload: true,
        }),
      },
    );
    if (!response.ok) {
      throw new LlmError('Qdrant search failed.', 'vector_store');
    }
    const body = (await response.json()) as {
      result?: {
        points?: Array<{ score?: number; payload?: Record<string, unknown> }>;
      };
    };
    return (body.result?.points ?? []).map((point) => {
      const payload = point.payload ?? {};
      return {
        id: String(payload.recordId ?? ''),
        documentId: String(payload.documentId ?? ''),
        title: String(payload.title ?? ''),
        category: String(payload.category ?? ''),
        version: Number(payload.version ?? 1),
        chunkIndex: Number(payload.chunkIndex ?? 0),
        content: String(payload.content ?? ''),
        score: Number(point.score ?? 0),
        embeddingModel: String(payload.embeddingModel ?? ''),
      };
    });
  }

  async listPublished(filter: PublishedChunkFilter): Promise<RetrievedChunk[]> {
    const base = this.requireUrl();
    const must: Array<Record<string, unknown>> = [
      { key: 'status', match: { value: 'published' } },
    ];
    if (filter.category) {
      must.push({ key: 'category', match: { value: filter.category } });
    }
    const response = await fetch(
      `${base}/collections/${this.collection()}/points/scroll`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          limit: filter.limit,
          filter: { must },
          with_payload: true,
          with_vector: false,
        }),
      },
    );
    if (!response.ok) {
      throw new LlmError('Qdrant scroll failed.', 'vector_store');
    }
    const body = (await response.json()) as {
      result?: { points?: Array<{ payload?: Record<string, unknown> }> };
    };
    return (body.result?.points ?? []).map((point) => {
      const payload = point.payload ?? {};
      const record: VectorRecord = {
        id: String(payload.recordId ?? ''),
        content: String(payload.content ?? ''),
        embedding: [],
        metadata: {
          documentId: String(payload.documentId ?? ''),
          title: String(payload.title ?? ''),
          category: String(payload.category ?? ''),
          version: Number(payload.version ?? 1),
          status: 'published',
          chunkIndex: Number(payload.chunkIndex ?? 0),
          createdAt: new Date(),
          source: payload.source === 'submission' ? 'submission' : 'knowledge',
          embeddingModel: String(payload.embeddingModel ?? ''),
          embeddingDimensions: Number(payload.embeddingDimensions ?? 0),
          contentHash: String(payload.contentHash ?? ''),
        },
      };
      return toRetrieved(record, 0);
    });
  }

  private async deleteByDocument(documentId: string): Promise<void> {
    const base = this.requireUrl();
    await fetch(`${base}/collections/${this.collection()}/points/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      }),
    });
  }

  private async ensureCollection(dimensions: number): Promise<void> {
    if (!dimensions || dimensions === this.ensuredDimensions) return;
    const base = this.requireUrl();
    const name = this.collection();
    const existing = await fetch(`${base}/collections/${name}`);
    if (existing.ok) {
      this.ensuredDimensions = dimensions;
      return;
    }
    const created = await fetch(`${base}/collections/${name}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vectors: { size: dimensions, distance: 'Cosine' },
      }),
    });
    if (!created.ok) {
      throw new LlmError(
        'Qdrant collection could not be created.',
        'vector_store',
      );
    }
    this.ensuredDimensions = dimensions;
    this.logger.log(
      JSON.stringify({ event: 'support.rag.qdrant_ready', name }),
    );
  }

  private requireUrl(): string {
    const url = this.settings.current().rag.qdrantUrl.replace(/\/$/, '');
    if (!url) {
      throw new LlmError('Qdrant is not configured.', 'qdrant_not_configured');
    }
    return url;
  }

  private collection(): string {
    return this.settings.current().rag.qdrantCollection;
  }
}

function pointId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}
