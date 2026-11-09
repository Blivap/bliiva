import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveIntelligenceSettings,
  type IntelligenceSettings,
} from './intelligence-settings.js';

@Injectable()
export class IntelligenceSettingsService {
  constructor(private readonly config: ConfigService) {}

  current(): IntelligenceSettings {
    return resolveIntelligenceSettings({
      autoHandleMinConfidence: this.config.get<number>(
        'intelligence.autoHandleMinConfidence',
      ),
      clarificationMinConfidence: this.config.get<number>(
        'intelligence.clarificationMinConfidence',
      ),
      ambiguityMargin: this.config.get<number>('intelligence.ambiguityMargin'),
      minCandidateScore: this.config.get<number>(
        'intelligence.minCandidateScore',
      ),
      alternativeMinScore: this.config.get<number>(
        'intelligence.alternativeMinScore',
      ),
      knowledgeMinScore: this.config.get<number>(
        'intelligence.knowledgeMinScore',
      ),
      maxClarificationAttempts: this.config.get<number>(
        'intelligence.maxClarificationAttempts',
      ),
      maxRepeatedQuestions: this.config.get<number>(
        'intelligence.maxRepeatedQuestions',
      ),
      cacheTtlMs: this.config.get<number>('intelligence.cacheTtlMs'),
    });
  }
}
