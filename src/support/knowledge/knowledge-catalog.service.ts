import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonCacheService } from '../../redis/json-cache.service.js';
import type { KnowledgeEntry } from '../intelligence/interfaces/knowledge-match.interface.js';
import { KnowledgeRepository } from './knowledge.repository.js';
import { toKnowledgeEntry } from './map-knowledge.js';

const CACHE_KEY = 'intelligence:knowledge:published';

@Injectable()
export class KnowledgeCatalogService {
  private memory: { expiresAt: number; items: KnowledgeEntry[] } | null = null;

  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly cache: JsonCacheService,
    private readonly config: ConfigService,
  ) {}

  async getPublished(): Promise<KnowledgeEntry[]> {
    const now = Date.now();
    if (this.memory && this.memory.expiresAt > now) return this.memory.items;

    const ttl = this.config.get<number>('intelligence.cacheTtlMs', 15000);
    const cached = await this.cache.get<KnowledgeEntry[]>(CACHE_KEY);
    if (cached) {
      this.memory = { expiresAt: now + ttl, items: cached };
      return cached;
    }

    const documents = await this.knowledge.findAllPublished();
    const items = documents.map((document) => toKnowledgeEntry(document));
    this.memory = { expiresAt: now + ttl, items };
    await this.cache.set(CACHE_KEY, items, ttl);
    return items;
  }

  async invalidate(): Promise<void> {
    this.memory = null;
    await this.cache.del(CACHE_KEY);
  }
}
