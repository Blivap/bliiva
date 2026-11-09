import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmRuntimeSettings {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  alternativeModel: string;
  temperature: number;
  timeoutMs: number;
  maxContextMessages: number;
  maxOutputTokens: number;
  maxContextTokens: number;
  numCtx: number;
  maxConcurrent: number;
  maxRetries: number;
  maxToolCalls: number;
  keepAlive: string;
  turnLimit: number;
  turnWindowMs: number;
}

export interface EmbeddingRuntimeSettings {
  provider: string;
  model: string;
  timeoutMs: number;
  batchSize: number;
}

export interface RagRuntimeSettings {
  enabled: boolean;
  topK: number;
  minRelevanceScore: number;
  chunkTokens: number;
  chunkOverlapTokens: number;
  charsPerToken: number;
  maxCandidates: number;
  semanticWeight: number;
  maxChunkChars: number;
  vectorStore: string;
  qdrantUrl: string;
  qdrantCollection: string;
}

export interface AiSettings {
  llm: LlmRuntimeSettings;
  embedding: EmbeddingRuntimeSettings;
  rag: RagRuntimeSettings;
}

@Injectable()
export class AiSettingsService {
  constructor(private readonly config: ConfigService) {}

  current(): AiSettings {
    return {
      llm: {
        enabled: this.config.get<boolean>('llm.enabled', false),
        provider: this.config.get<string>('llm.provider', 'ollama'),
        baseUrl: this.config.get<string>(
          'llm.baseUrl',
          'http://127.0.0.1:11434',
        ),
        model: this.config.get<string>('llm.model', 'qwen3:1.7b'),
        alternativeModel: this.config.get<string>(
          'llm.alternativeModel',
          'qwen3:4b',
        ),
        temperature: this.config.get<number>('llm.temperature', 0.2),
        timeoutMs: this.config.get<number>('llm.timeoutMs', 60000),
        maxContextMessages: this.config.get<number>(
          'llm.maxContextMessages',
          10,
        ),
        maxOutputTokens: this.config.get<number>('llm.maxOutputTokens', 512),
        maxContextTokens: this.config.get<number>('llm.maxContextTokens', 2048),
        numCtx: this.config.get<number>('llm.numCtx', 2048),
        maxConcurrent: this.config.get<number>('llm.maxConcurrent', 1),
        maxRetries: this.config.get<number>('llm.maxRetries', 1),
        maxToolCalls: this.config.get<number>('llm.maxToolCalls', 3),
        keepAlive: this.config.get<string>('llm.keepAlive', '5m'),
        turnLimit: this.config.get<number>('llm.turnLimit', 12),
        turnWindowMs: this.config.get<number>('llm.turnWindowMs', 60000),
      },
      embedding: {
        provider: this.config.get<string>('embedding.provider', 'ollama'),
        model: this.config.get<string>('embedding.model', 'nomic-embed-text'),
        timeoutMs: this.config.get<number>('embedding.timeoutMs', 30000),
        batchSize: this.config.get<number>('embedding.batchSize', 8),
      },
      rag: {
        enabled: this.config.get<boolean>('rag.enabled', true),
        topK: this.config.get<number>('rag.topK', 5),
        minRelevanceScore: this.config.get<number>(
          'rag.minRelevanceScore',
          0.55,
        ),
        chunkTokens: this.config.get<number>('rag.chunkTokens', 500),
        chunkOverlapTokens: this.config.get<number>(
          'rag.chunkOverlapTokens',
          80,
        ),
        charsPerToken: this.config.get<number>('rag.charsPerToken', 4),
        maxCandidates: this.config.get<number>('rag.maxCandidates', 400),
        semanticWeight: this.config.get<number>('rag.semanticWeight', 0.7),
        maxChunkChars: this.config.get<number>('rag.maxChunkChars', 800),
        vectorStore: this.config.get<string>('rag.vectorStore', 'mongodb'),
        qdrantUrl: this.config.get<string>('rag.qdrantUrl', ''),
        qdrantCollection: this.config.get<string>(
          'rag.qdrantCollection',
          'bliiva_knowledge',
        ),
      },
    };
  }
}
