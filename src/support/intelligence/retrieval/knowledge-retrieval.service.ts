import { Injectable } from '@nestjs/common';
import { KnowledgeCatalogService } from '../../knowledge/knowledge-catalog.service.js';
import type { KnowledgeRanking } from '../interfaces/knowledge-match.interface.js';
import { IntelligenceSettingsService } from '../intelligence-settings.service.js';
import { rankKnowledge } from './rank-knowledge.js';

@Injectable()
export class KnowledgeRetrievalService {
  constructor(
    private readonly catalog: KnowledgeCatalogService,
    private readonly settings: IntelligenceSettingsService,
  ) {}

  async retrieve(input: {
    text: string;
    intent: string | null;
    category: string | null;
    preferredKnowledgeId?: string | null;
  }): Promise<KnowledgeRanking> {
    const entries = await this.catalog.getPublished();
    return rankKnowledge({
      text: input.text,
      entries,
      intent: input.intent,
      category: input.category,
      settings: this.settings.current(),
      preferredKnowledgeId: input.preferredKnowledgeId,
    });
  }
}
