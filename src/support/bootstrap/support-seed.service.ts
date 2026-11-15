import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../../common/constants/collection-names.js';
import {
  blivapIntents,
  blivapKnowledge,
} from '../intelligence/dataset/blivap-support.dataset.js';

/**
 * Idempotent starter seed so `docker compose up` has intents/knowledge
 * without a separate yarn seed step.
 */
@Injectable()
export class SupportSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SupportSeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.config.get<boolean>('seedOnStart', true);
    if (!enabled) return;

    const db = this.connection.db;
    if (!db) {
      this.logger.warn('Skip seed — MongoDB connection unavailable');
      return;
    }

    const intents = db.collection(SUPPORT_COLLECTIONS.intents);
    const knowledge = db.collection(SUPPORT_COLLECTIONS.knowledge);
    const now = new Date();

    for (const intent of blivapIntents) {
      await intents.updateOne(
        { name: intent.name },
        {
          $set: { ...intent, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    for (const entry of blivapKnowledge) {
      const { id: _id, ...fields } = entry;
      await knowledge.updateOne(
        { title: entry.title, language: entry.language, version: 1 },
        {
          $set: {
            ...fields,
            version: 1,
            publishedAt: now,
            createdBy: null,
            updatedBy: null,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    this.logger.log(
      `Seeded ${blivapIntents.length} intents and ${blivapKnowledge.length} knowledge entries`,
    );
  }
}
