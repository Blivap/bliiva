import { Injectable } from '@nestjs/common';
import { cleanText } from './text-cleaner.js';

@Injectable()
export class TextCleanerService {
  clean(value: string): string {
    return cleanText(value);
  }
}
