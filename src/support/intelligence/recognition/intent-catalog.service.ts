import { Injectable } from '@nestjs/common';
import { JsonCacheService } from '../../../redis/json-cache.service.js';
import { IntentRepository } from '../intent.repository.js';
import type { IntentDefinition } from '../interfaces/intent-definition.interface.js';
import { IntelligenceSettingsService } from '../intelligence-settings.service.js';
import { toIntentDefinition } from './map-intent.js';

const CACHE_KEY = 'intelligence:intents:enabled';

@Injectable()
export class IntentCatalogService {
  private memory: { expiresAt: number; items: IntentDefinition[] } | null =
    null;

  constructor(
    private readonly intents: IntentRepository,
    private readonly cache: JsonCacheService,
    private readonly settings: IntelligenceSettingsService,
  ) {}

  async getEnabled(): Promise<IntentDefinition[]> {
    const now = Date.now();
    if (this.memory && this.memory.expiresAt > now) return this.memory.items;

    const ttl = this.settings.current().cacheTtlMs;
    const cached = await this.cache.get<IntentDefinition[]>(CACHE_KEY);
    if (cached) {
      this.memory = { expiresAt: now + ttl, items: cached };
      return cached;
    }

    const documents = await this.intents.findEnabled();
    const items = documents.map((document) => toIntentDefinition(document));
    this.memory = { expiresAt: now + ttl, items };
    await this.cache.set(CACHE_KEY, items, ttl);
    return items;
  }

  async invalidate(): Promise<void> {
    this.memory = null;
    await this.cache.del(CACHE_KEY);
  }
}
