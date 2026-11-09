import configuration from '../src/config/configuration.js';
import { envValidationSchema } from '../src/config/validation.js';
import { SUPPORT_COLLECTIONS } from '../src/common/constants/collection-names.js';
import {
  ConversationStatus,
  OrchestratorResponseType,
  TicketStatus,
} from '../src/common/enums/index.js';

describe('Phase 1 foundation smoke (e2e)', () => {
  it('loads default configuration', () => {
    const config = configuration();
    expect(config.apiPrefix).toBe('api/v1');
    expect(config.database.uri).toContain('bliiva_support');
    expect(config.bullmq.prefix).toBe('{bliiva}');
    expect(config.intelligence.autoHandleMinConfidence).toBe(0.85);
    expect(config.llm.enabled).toBe(false);
    expect(config.llm.provider).toBe('ollama');
    expect(config.llm.model).toBe('qwen3:1.7b');
    expect(config.embedding.model).toBe('nomic-embed-text');
    expect(config.rag.topK).toBe(5);
    expect(config.rag.vectorStore).toBe('mongodb');
    expect(config.llm.enabled).toBe(false);
    expect(config.llm.model).toBe('qwen3:1.7b');
    expect(config.embedding.model).toBe('nomic-embed-text');
    expect(config.rag.vectorStore).toBe('mongodb');
  });

  it('validates environment schema with defaults', () => {
    const { error, value } = envValidationSchema.validate(
      {},
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeUndefined();
    expect(value.MONGODB_URI).toContain('bliiva_support');
    expect(value.API_PREFIX).toBe('api/v1');
    expect(value.LLM_ENABLED).toBe('false');
    expect(value.LLM_MODEL).toBe('qwen3:1.7b');
    expect(value.RAG_ENABLED).toBe('true');
  });

  it('exposes distinct support collection names', () => {
    const names = Object.values(SUPPORT_COLLECTIONS);
    expect(names).toHaveLength(13);
    expect(new Set(names).size).toBe(13);
    expect(SUPPORT_COLLECTIONS.conversations).toBe('support_conversations');
  });

  it('defines orchestrator and domain enums', () => {
    expect(ConversationStatus.Bot).toBe('bot');
    expect(TicketStatus.Open).toBe('open');
    expect(OrchestratorResponseType.Escalated).toBe('ESCALATED');
  });
});
