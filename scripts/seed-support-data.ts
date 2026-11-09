/**
 * Upsert the Phase 2 Blivap intent catalog and published knowledge.
 *
 *   yarn seed:support
 *
 * Safe to re-run. Existing intents are updated in place by name.
 * Knowledge is upserted by intent + language + version 1.
 * Entries are not auto-published from conversations; this seed is the
 * reviewed starter set.
 *
 * Imports the compiled Nest output under dist/ so Node can resolve .js paths.
 * Excluded from `yarn typecheck` (see tsconfig.json) because dist/ exists only after build.
 */
import mongoose from 'mongoose';
import { SUPPORT_COLLECTIONS } from '../dist/common/constants/collection-names.js';
import {
  blivapIntents,
  blivapKnowledge,
} from '../dist/support/intelligence/dataset/blivap-support.dataset.js';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bliiva_support';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection unavailable');
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
      { intent: entry.intent, language: entry.language, version: 1 },
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

  console.log(
    `Seeded ${blivapIntents.length} intents and ${blivapKnowledge.length} knowledge entries.`,
  );
  await mongoose.disconnect();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
