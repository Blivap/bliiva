import { Injectable } from '@nestjs/common';
import { isSupportCategory } from '../../../common/constants/support-categories.js';
import {
  DocumentRejectedError,
  type IngestibleDocument,
} from '../rag.types.js';
import { cleanText, containsPrivateRecord } from './text-cleaner.js';

export interface SubmissionInput {
  documentId: string;
  title: string;
  category: string;
  language?: string;
  version: number;
  status: 'published' | 'archived';
  text: string;
  filename?: string;
  source: 'knowledge' | 'submission';
}

@Injectable()
export class DocumentParserService {
  parse(input: SubmissionInput): IngestibleDocument {
    if (input.filename && !/\.(md|txt)$/i.test(input.filename)) {
      throw new DocumentRejectedError(
        'Only .md and .txt documents can be ingested.',
      );
    }
    if (!isSupportCategory(input.category)) {
      throw new DocumentRejectedError('Unknown knowledge category.');
    }
    const text = cleanText(input.text);
    if (text.length < 20) {
      throw new DocumentRejectedError('Document content is too short.');
    }
    if (text.length > 100_000) {
      throw new DocumentRejectedError('Document content is too long.');
    }
    if (containsPrivateRecord(text)) {
      throw new DocumentRejectedError(
        'Private identity or medical records cannot be added to the knowledge base.',
      );
    }
    return {
      documentId: input.documentId,
      title: input.title.trim(),
      category: input.category,
      language: input.language?.trim() || 'en',
      version: input.version,
      status: input.status,
      text,
      source: input.source,
    };
  }
}
