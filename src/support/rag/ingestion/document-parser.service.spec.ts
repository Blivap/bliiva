import { describe, expect, it } from 'vitest';
import { DocumentRejectedError } from '../rag.types.js';
import { DocumentParserService } from './document-parser.service.js';

describe('DocumentParserService', () => {
  const parser = new DocumentParserService();

  it('accepts approved support text', () => {
    const document = parser.parse({
      documentId: 'doc1',
      title: 'Donor registration',
      category: 'donor_registration',
      version: 1,
      status: 'published',
      text: 'To register as a donor, open Profile and complete the donor form.',
      filename: 'donor.md',
      source: 'submission',
    });
    expect(document.category).toBe('donor_registration');
  });

  it('rejects private identity records', () => {
    expect(() =>
      parser.parse({
        documentId: 'doc2',
        title: 'Bad',
        category: 'privacy_security',
        version: 1,
        status: 'published',
        text: 'Customer NIN: 12345678901 should never be stored here.',
        filename: 'bad.txt',
        source: 'submission',
      }),
    ).toThrow(DocumentRejectedError);
  });

  it('rejects unsupported file types', () => {
    expect(() =>
      parser.parse({
        documentId: 'doc3',
        title: 'Scan',
        category: 'general_enquiries',
        version: 1,
        status: 'published',
        text: 'Enough characters to pass the minimum length check.',
        filename: 'id-card.pdf',
        source: 'submission',
      }),
    ).toThrow(/Only \.md and \.txt/);
  });
});
