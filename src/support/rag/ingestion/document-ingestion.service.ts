import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeStatus } from '../../../common/enums/index.js';
import { KnowledgeRepository } from '../../knowledge/knowledge.repository.js';
import { EmbeddingService } from '../embeddings/embedding.service.js';
import type { IngestibleDocument, VectorRecord } from '../rag.types.js';
import { Inject } from '@nestjs/common';
import { VECTOR_STORE } from '../vector-store/vector-store.factory.js';
import type { VectorStore } from '../vector-store/vector-store.interface.js';
import { ChunkingService } from './chunking.service.js';
import { DocumentParserService } from './document-parser.service.js';

export interface IngestionReport {
  documents: number;
  embedded: number;
  skipped: number;
  archived: number;
  rejected: number;
  errors: string[];
}

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);

  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly parser: DocumentParserService,
    private readonly chunking: ChunkingService,
    private readonly embeddings: EmbeddingService,
    @Inject(VECTOR_STORE) private readonly store: VectorStore,
  ) {}

  async reindexAll(): Promise<IngestionReport> {
    const report = emptyReport();
    const documents = await this.knowledge.findAll();
    for (const document of documents) {
      try {
        await this.syncParsed(this.fromKnowledge(document), report);
      } catch (error) {
        report.rejected += 1;
        report.errors.push(error instanceof Error ? error.message : 'unknown');
      }
    }
    return report;
  }

  async syncDocument(id: string): Promise<void> {
    try {
      const document = await this.knowledge.findById(id);
      if (!document) return;
      const report = emptyReport();
      await this.syncParsed(this.fromKnowledge(document), report);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'support.rag.sync_failed',
          id,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }

  async ingestSubmission(input: {
    documentId: string;
    title: string;
    category: string;
    text: string;
    filename?: string;
    language?: string;
  }): Promise<IngestionReport> {
    const report = emptyReport();
    const parsed = this.parser.parse({
      ...input,
      version: 1,
      status: 'published',
      source: 'submission',
    });
    await this.syncParsed(parsed, report);
    return report;
  }

  private fromKnowledge(document: {
    _id?: unknown;
    title: string;
    category: string;
    language?: string;
    version?: number;
    status?: string;
    questions?: string[];
    answer: string;
  }): IngestibleDocument {
    const id = String(document._id);
    return this.parser.parse({
      documentId: id,
      title: document.title,
      category: document.category,
      language: document.language,
      version: document.version ?? 1,
      status:
        document.status === KnowledgeStatus.Published
          ? 'published'
          : 'archived',
      text: [document.title, ...(document.questions ?? []), document.answer]
        .filter(Boolean)
        .join('\n\n'),
      filename: 'knowledge.txt',
      source: 'knowledge',
    });
  }

  private async syncParsed(
    document: IngestibleDocument,
    report: IngestionReport,
  ): Promise<void> {
    report.documents += 1;
    try {
      if (document.status !== 'published') {
        await this.store.markStatus(document.documentId, 'archived');
        report.archived += 1;
        return;
      }
      const pieces = this.chunking.chunk(document.text);
      const hashes = pieces.map((piece) => contentHash(piece));
      const model = this.embeddings.model;
      const existing = await this.store.listDocument(document.documentId);
      const reusable = new Map(
        existing
          .filter(
            (item) =>
              item.embeddingModel === model && item.embedding.length > 0,
          )
          .map((item) => [item.contentHash, item.embedding]),
      );
      const missing = pieces.filter(
        (_piece, index) => !reusable.has(hashes[index] ?? ''),
      );
      const embedded = missing.length
        ? await this.embeddings.embed(missing)
        : [];
      let embeddedIndex = 0;
      const vectors = pieces.map((_piece, index) => {
        const cached = reusable.get(hashes[index] ?? '');
        if (cached) {
          report.skipped += 1;
          return cached;
        }
        const vector = embedded[embeddedIndex] ?? [];
        embeddedIndex += 1;
        return vector;
      });
      const dimensions = vectors[0]?.length ?? 0;
      const createdAt = new Date();
      const records: VectorRecord[] = pieces.map((content, index) => ({
        id: `${document.documentId}:${index}`,
        content,
        embedding: vectors[index] ?? [],
        metadata: {
          documentId: document.documentId,
          title: document.title,
          category: document.category,
          language: document.language,
          version: document.version,
          status: 'published',
          chunkIndex: index,
          createdAt,
          source: document.source,
          embeddingModel: model,
          embeddingDimensions: dimensions,
          contentHash: hashes[index] ?? contentHash(content),
        },
      }));
      await this.store.replaceDocument(document.documentId, records);
      report.embedded += records.length;
    } catch (error) {
      report.rejected += 1;
      const message = error instanceof Error ? error.message : 'unknown';
      report.errors.push(`${document.documentId}: ${message}`);
      this.logger.warn(
        JSON.stringify({
          event: 'support.rag.ingest_rejected',
          documentId: document.documentId,
          message,
        }),
      );
    }
  }
}

export function contentHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function emptyReport(): IngestionReport {
  return {
    documents: 0,
    embedded: 0,
    skipped: 0,
    archived: 0,
    rejected: 0,
    errors: [],
  };
}
