import type { KnowledgeStatus } from '../../../common/enums/index.js';

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  intent: string;
  questions: string[];
  phrases: string[];
  keywords: string[];
  synonyms: string[];
  answer: string;
  status: KnowledgeStatus;
  priority: number;
  requiresAuthentication: boolean;
  requiresHumanSupport: boolean;
  language: string;
}

export interface KnowledgeMatchResult {
  knowledgeId: string;
  title: string;
  answer: string;
  score: number;
  matchedTerms: string[];
  intent: string;
  category: string;
  requiresAuthentication: boolean;
  requiresHumanSupport: boolean;
  priority: number;
}

export interface KnowledgeRanking {
  matches: KnowledgeMatchResult[];
  best: KnowledgeMatchResult | null;
  ambiguous: boolean;
}
