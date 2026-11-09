export default () => {
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    database: {
      uri:
        process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bliiva_support',
    },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB ?? '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'bliiva:',
    },
    bullmq: {
      prefix: process.env.BULLMQ_PREFIX ?? '{bliiva}',
    },
    swagger: {
      enabled: swaggerEnabled,
      path: process.env.SWAGGER_PATH ?? 'docs',
    },
    throttle: {
      ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
    },
    serviceAuth: {
      apiKey: process.env.SUPPORT_SERVICE_API_KEY ?? '',
      userJwtSecret: process.env.SUPPORT_USER_JWT_SECRET ?? '',
    },
    blivap: {
      baseUrl: process.env.BLIVAP_API_BASE_URL ?? 'http://localhost:2001',
      serviceApiKey: process.env.BLIVAP_SERVICE_API_KEY ?? '',
      timeoutMs: parseInt(process.env.BLIVAP_TIMEOUT_MS ?? '10000', 10),
      client: process.env.BLIVAP_CLIENT ?? 'http',
    },
    actions: {
      confirmationTtlMs: parseInt(
        process.env.ACTION_CONFIRMATION_TTL_MS ?? '300000',
        10,
      ),
    },
    intelligence: {
      autoHandleMinConfidence: parseFloat(
        process.env.AUTO_HANDLE_MIN_CONFIDENCE ?? '0.85',
      ),
      clarificationMinConfidence: parseFloat(
        process.env.CLARIFICATION_MIN_CONFIDENCE ?? '0.6',
      ),
      ambiguityMargin: parseFloat(
        process.env.INTENT_AMBIGUITY_MARGIN ?? '0.08',
      ),
      minCandidateScore: parseFloat(
        process.env.INTENT_MIN_CANDIDATE_SCORE ?? '0.34',
      ),
      alternativeMinScore: parseFloat(
        process.env.INTENT_ALTERNATIVE_MIN_SCORE ?? '0.18',
      ),
      knowledgeMinScore: parseFloat(process.env.KNOWLEDGE_MIN_SCORE ?? '0.55'),
      maxClarificationAttempts: parseInt(
        process.env.MAX_CLARIFICATION_ATTEMPTS ?? '2',
        10,
      ),
      maxRepeatedQuestions: parseInt(
        process.env.MAX_REPEATED_QUESTIONS ?? '2',
        10,
      ),
      cacheTtlMs: parseInt(
        process.env.INTELLIGENCE_CACHE_TTL_MS ?? '15000',
        10,
      ),
    },
    observe: {
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
    },
    llm: {
      enabled: process.env.LLM_ENABLED === 'true',
      provider: process.env.LLM_PROVIDER ?? 'ollama',
      baseUrl: process.env.LLM_BASE_URL ?? 'http://127.0.0.1:11434',
      model: process.env.LLM_MODEL ?? 'qwen3:1.7b',
      alternativeModel: process.env.LLM_ALTERNATIVE_MODEL ?? 'qwen3:4b',
      temperature: parseFloat(process.env.LLM_TEMPERATURE ?? '0.2'),
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? '60000', 10),
      maxContextMessages: parseInt(
        process.env.LLM_MAX_CONTEXT_MESSAGES ?? '10',
        10,
      ),
      maxOutputTokens: parseInt(process.env.LLM_MAX_OUTPUT_TOKENS ?? '512', 10),
      maxContextTokens: parseInt(
        process.env.LLM_MAX_CONTEXT_TOKENS ?? '2048',
        10,
      ),
      numCtx: parseInt(process.env.LLM_NUM_CTX ?? '2048', 10),
      maxConcurrent: parseInt(process.env.LLM_MAX_CONCURRENT ?? '1', 10),
      maxRetries: parseInt(process.env.LLM_MAX_RETRIES ?? '1', 10),
      maxToolCalls: parseInt(process.env.LLM_MAX_TOOL_CALLS ?? '3', 10),
      keepAlive: process.env.LLM_KEEP_ALIVE ?? '5m',
      turnLimit: parseInt(process.env.LLM_TURN_LIMIT ?? '12', 10),
      turnWindowMs: parseInt(process.env.LLM_TURN_WINDOW_MS ?? '60000', 10),
    },
    embedding: {
      provider: process.env.EMBEDDING_PROVIDER ?? 'ollama',
      model: process.env.EMBEDDING_MODEL ?? 'nomic-embed-text',
      timeoutMs: parseInt(process.env.EMBEDDING_TIMEOUT_MS ?? '30000', 10),
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE ?? '8', 10),
    },
    rag: {
      enabled: process.env.RAG_ENABLED !== 'false',
      topK: parseInt(process.env.RAG_TOP_K ?? '5', 10),
      minRelevanceScore: parseFloat(
        process.env.RAG_MIN_RELEVANCE_SCORE ?? '0.55',
      ),
      chunkTokens: parseInt(process.env.RAG_CHUNK_TOKENS ?? '500', 10),
      chunkOverlapTokens: parseInt(
        process.env.RAG_CHUNK_OVERLAP_TOKENS ?? '80',
        10,
      ),
      charsPerToken: parseInt(process.env.RAG_CHARS_PER_TOKEN ?? '4', 10),
      maxCandidates: parseInt(process.env.RAG_MAX_CANDIDATES ?? '400', 10),
      semanticWeight: parseFloat(process.env.RAG_SEMANTIC_WEIGHT ?? '0.7'),
      maxChunkChars: parseInt(process.env.RAG_MAX_CHUNK_CHARS ?? '800', 10),
      vectorStore: process.env.VECTOR_STORE ?? 'mongodb',
      qdrantUrl: process.env.QDRANT_URL ?? '',
      qdrantCollection: process.env.QDRANT_COLLECTION ?? 'bliiva_knowledge',
    },
  };
};
