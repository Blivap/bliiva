import { Injectable } from '@nestjs/common';
import { AiSettingsService } from '../ai/ai-settings.service.js';
import type { RagHit, RagQuery } from './retrieval/retrieval.service.js';
import { RetrievalService } from './retrieval/retrieval.service.js';

@Injectable()
export class RagService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly settings: AiSettingsService,
  ) {}

  retrieve(query: RagQuery): Promise<RagHit> {
    return this.retrieval.retrieve(query);
  }

  clip(content: string): string {
    const limit = this.settings.current().rag.maxChunkChars;
    if (content.length <= limit) return content;
    return `${content.slice(0, limit).trim()}…`;
  }
}
