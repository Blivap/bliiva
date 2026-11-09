import { toIdString } from '../../common/auth/to-id-string.js';
import { KnowledgeStatus } from '../../common/enums/index.js';
import type { KnowledgeEntry } from '../intelligence/interfaces/knowledge-match.interface.js';

export interface KnowledgeRecord {
  _id?: unknown;
  id?: unknown;
  title: string;
  category: string;
  intent: string;
  questions?: string[];
  phrases?: string[];
  keywords?: string[];
  synonyms?: string[];
  answer: string;
  status?: KnowledgeStatus;
  priority?: number;
  requiresAuthentication?: boolean;
  requiresHumanSupport?: boolean;
  language?: string;
}

export function toKnowledgeEntry(record: KnowledgeRecord): KnowledgeEntry {
  const id = record._id ?? record.id;
  return {
    id: toIdString(id),
    title: record.title,
    category: record.category,
    intent: record.intent,
    questions: record.questions ?? [],
    phrases: record.phrases ?? [],
    keywords: record.keywords ?? [],
    synonyms: record.synonyms ?? [],
    answer: record.answer,
    status: record.status ?? KnowledgeStatus.Draft,
    priority: record.priority ?? 0,
    requiresAuthentication: record.requiresAuthentication === true,
    requiresHumanSupport: record.requiresHumanSupport === true,
    language: record.language ?? 'en',
  };
}
