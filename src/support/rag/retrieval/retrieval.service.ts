import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AiSettingsService } from '../../ai/ai-settings.service.js';
import { EmbeddingService } from '../embeddings/embedding.service.js';
import type { RetrievedChunk } from '../rag.types.js';
import { VECTOR_STORE } from '../vector-store/vector-store.factory.js';
import type { VectorStore } from '../vector-store/vector-store.interface.js';
import { hybridRank, keywordScore } from './hybrid-rank.js';

export interface RagQuery {
  text: string;
  category?: string;
  /** Skip embedding calls (avoids thrashing chat/embed models on small hosts). */
  keywordOnly?: boolean;
}

export interface RagHit {
  chunks: RetrievedChunk[];
  durationMs: number;
  semanticAvailable: boolean;
  embeddingMismatch: boolean;
  missingEmbeddings: number;
  failed: boolean;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly settings: AiSettingsService,
    private readonly embeddings: EmbeddingService,
    @Inject(VECTOR_STORE) private readonly store: VectorStore,
  ) {}

  async retrieve(query: RagQuery): Promise<RagHit> {
    const started = Date.now();
    const rag = this.settings.current().rag;
    const empty: RagHit = {
      chunks: [],
      durationMs: 0,
      semanticAvailable: false,
      embeddingMismatch: false,
      missingEmbeddings: 0,
      failed: false,
    };
    if (!rag.enabled) {
      return { ...empty, durationMs: Date.now() - started };
    }
    try {
      const published = await this.store.listPublished({
        category: query.category,
        limit: rag.maxCandidates,
      });
      const model = this.embeddings.model;
      const missingEmbeddings = published.filter(
        (chunk) => !chunk.embeddingModel,
      ).length;
      const otherModel = published.filter(
        (chunk) => chunk.embeddingModel && chunk.embeddingModel !== model,
      ).length;
      const keyword = published
        .map((chunk) => ({
          ...chunk,
          score: keywordScore(query.text, `${chunk.title} ${chunk.content}`),
        }))
        .filter((chunk) => chunk.score > 0);

      let semantic: RetrievedChunk[] = [];
      let semanticAvailable = false;
      const allowSemantic =
        !query.keywordOnly && rag.semanticWeight > 0;
      if (allowSemantic) {
        try {
          const [vector] = await this.embeddings.embed([query.text]);
          semantic = await this.store.search({
            embedding: vector,
            embeddingModel: model,
            topK: rag.topK,
            minScore: 0,
            category: query.category,
            maxCandidates: rag.maxCandidates,
          });
          semanticAvailable = true;
        } catch (error) {
          this.logger.warn(
            JSON.stringify({
              event: 'support.rag.semantic_failed',
              message: error instanceof Error ? error.message : 'unknown',
            }),
          );
        }
      }

      const chunks = hybridRank({
        semantic,
        keyword,
        semanticWeight: semanticAvailable ? rag.semanticWeight : 0,
        topK: rag.topK,
        minScore: rag.minRelevanceScore,
      });
      return {
        chunks,
        durationMs: Date.now() - started,
        semanticAvailable,
        embeddingMismatch: otherModel > 0 && semantic.length === 0,
        missingEmbeddings,
        failed: false,
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'support.rag.retrieve_failed',
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return {
        ...empty,
        durationMs: Date.now() - started,
        failed: true,
      };
    }
  }
}
