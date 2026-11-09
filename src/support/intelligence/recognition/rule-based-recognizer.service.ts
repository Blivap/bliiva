import { Injectable } from '@nestjs/common';
import type {
  IntentRecognitionResult,
  IntentRecognizer,
  RecognitionContext,
} from '../interfaces/intent-recognizer.interface.js';
import { IntelligenceSettingsService } from '../intelligence-settings.service.js';
import { IntentCatalogService } from './intent-catalog.service.js';
import { recognizeIntents } from './recognize-intents.js';

@Injectable()
export class RuleBasedRecognizerService implements IntentRecognizer {
  constructor(
    private readonly catalog: IntentCatalogService,
    private readonly settings: IntelligenceSettingsService,
  ) {}

  async recognize(
    text: string,
    context?: RecognitionContext,
  ): Promise<IntentRecognitionResult> {
    const intents = await this.catalog.getEnabled();
    return recognizeIntents(text, intents, this.settings.current(), context);
  }
}
