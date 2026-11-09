import { Injectable } from '@nestjs/common';
import { IntelligenceSettingsService } from '../intelligence-settings.service.js';
import {
  decideSupportResponse,
  type DecisionInput,
} from './decision-engine.js';
import type { SupportDecision } from '../interfaces/decision.interface.js';

@Injectable()
export class DecisionEngineService {
  constructor(private readonly settings: IntelligenceSettingsService) {}

  decide(input: Omit<DecisionInput, 'settings'>): SupportDecision {
    return decideSupportResponse({
      ...input,
      settings: this.settings.current(),
    });
  }
}
