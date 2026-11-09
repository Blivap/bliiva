import { Inject, Injectable } from '@nestjs/common';
import { AiSettingsService } from '../../ai/ai-settings.service.js';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './embedding.interface.js';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly settings: AiSettingsService,
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
  ) {}

  get model(): string {
    return this.provider.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const batchSize = this.settings.current().embedding.batchSize;
    const vectors: number[][] = [];
    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = texts.slice(index, index + batchSize);
      const embedded = await this.provider.embed(batch);
      vectors.push(...embedded);
    }
    const dimensions = vectors[0]?.length ?? 0;
    if (
      vectors.some((vector) => vector.length !== dimensions || dimensions === 0)
    ) {
      throw new Error('Embedding dimensions are inconsistent.');
    }
    return vectors;
  }
}
