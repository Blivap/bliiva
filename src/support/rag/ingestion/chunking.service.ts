import { Injectable } from '@nestjs/common';
import { AiSettingsService } from '../../ai/ai-settings.service.js';

@Injectable()
export class ChunkingService {
  constructor(private readonly settings: AiSettingsService) {}

  chunk(text: string): string[] {
    const rag = this.settings.current().rag;
    return chunkText(text, {
      chunkTokens: rag.chunkTokens,
      overlapTokens: rag.chunkOverlapTokens,
      charsPerToken: rag.charsPerToken,
    });
  }
}

export function chunkText(
  text: string,
  options: {
    chunkTokens: number;
    overlapTokens: number;
    charsPerToken: number;
  },
): string[] {
  const size = Math.max(200, options.chunkTokens * options.charsPerToken);
  const overlap = Math.min(
    Math.max(0, size - 1),
    Math.max(0, options.overlapTokens * options.charsPerToken),
  );
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < 200) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const breakAt = text.lastIndexOf('\n', end);
      if (breakAt > start + Math.floor(size / 2)) end = breakAt;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    const next = end - overlap;
    start = next > start ? next : end;
  }
  return chunks;
}
