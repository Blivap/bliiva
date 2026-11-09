import type { RetrievedChunk, VectorRecord } from '../rag.types.js';

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function rankByCosine(
  records: VectorRecord[],
  embedding: number[],
  embeddingModel: string,
  topK: number,
  minScore: number,
): RetrievedChunk[] {
  return records
    .filter(
      (record) =>
        record.metadata.status === 'published' &&
        record.metadata.embeddingModel === embeddingModel &&
        record.embedding.length === embedding.length,
    )
    .map((record) =>
      toRetrieved(record, cosineSimilarity(record.embedding, embedding)),
    )
    .filter((record) => record.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export function toRetrieved(
  record: VectorRecord,
  score: number,
): RetrievedChunk {
  return {
    id: record.id,
    documentId: record.metadata.documentId,
    title: record.metadata.title,
    category: record.metadata.category,
    language: record.metadata.language,
    version: record.metadata.version,
    chunkIndex: record.metadata.chunkIndex,
    content: record.content,
    score,
    embeddingModel: record.metadata.embeddingModel,
  };
}
