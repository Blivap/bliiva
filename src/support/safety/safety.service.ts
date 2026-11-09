import { Injectable } from '@nestjs/common';
import { inspectMessage, type SafetyAssessment } from './safety-rules.js';

@Injectable()
export class SafetyService {
  inspect(text: string): SafetyAssessment {
    return inspectMessage(text);
  }
}
