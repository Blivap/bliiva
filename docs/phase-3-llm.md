# Phase 3 — Self-hosted LLM support agent

Bliiva keeps the Phase 1/2 deterministic engine as the safety net. When `LLM_ENABLED=true`, the orchestrator tries a local Ollama chat model with RAG and allowlisted tools first. If the model is busy, unavailable, timed out, or returns an ungrounded answer, the conversation falls back to the rules engine.

## Local development (8 GB RAM)

1. Start Mongo, Redis, and optionally Ollama:

```bash
docker compose up -d mongo redis
docker compose --profile llm up -d ollama
docker compose exec ollama ollama pull qwen3:1.7b
docker compose exec ollama ollama pull nomic-embed-text
```

2. Enable the agent in `.env`:

```env
LLM_ENABLED=true
LLM_BASE_URL=http://127.0.0.1:11434
LLM_MODEL=qwen3:1.7b
EMBEDDING_MODEL=nomic-embed-text
RAG_ENABLED=true
VECTOR_STORE=mongodb
```

3. Seed knowledge, start the API, then reindex embeddings:

```bash
yarn seed:support
yarn start:dev
# admin: POST /api/v1/support/admin/rag/reindex
```

Expected memory: Ollama with Qwen3 1.7B + nomic-embed-text fits an 8 GB laptop when `LLM_MAX_CONCURRENT=1` and `LLM_NUM_CTX=2048`. Qwen3 4B needs more headroom and should not run beside heavy IDE/browser loads.

## Production

Run inference on a **separate** private host. Do not put Ollama on the ~1 GB DigitalOcean API droplet, and do not depend on a developer MacBook.

Recommended layout:

- NestJS API reaches `LLM_BASE_URL` over a private network / VPN / internal DNS only.
- Port `11434` is bound to the private interface. It is never exposed to the public internet or to the Next.js frontend.
- Production `.env` sets `LLM_ENABLED=true`, a private `LLM_BASE_URL`, and restart policies on the inference host.
- Keep `LLM_MODEL=qwen3:4b` (or larger) only when the inference box has enough RAM. Development can stay on `qwen3:1.7b`.

Persistence and recovery:

- Persist Ollama model layers on a dedicated volume.
- Back up MongoDB knowledge + `support_knowledge_chunks`.
- After restoring knowledge, call `POST /support/admin/rag/reindex`.

## Security model

- Tools are the existing Phase 3 action registry. The model cannot invent endpoints or open MongoDB.
- Authenticated identity always comes from the support actor / Blivap JWT, never from chat text or tool arguments named `userId`.
- High-risk mutations still require confirmation.
- Prompt injection attempts escalate to a human.
- Passwords, OTPs, and tokens are redacted before prompts and analytics.

## Admin API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/support/admin/llm/health` | Runtime + model availability |
| `GET` | `/support/admin/llm/config` | Non-secret configuration |
| `GET` | `/support/admin/llm/metrics` | Latency, tools, escalations |
| `POST` | `/support/admin/llm/unload` | Ask Ollama to unload the chat model |
| `POST` | `/support/admin/rag/reindex` | Rebuild embeddings |
| `POST` | `/support/admin/rag/ingest` | Ingest an approved document |
| `POST` | `/support/admin/rag/test` | Trial hybrid retrieval |

## Example conversations

With `LLM_ENABLED=true` and a published knowledge index:

| User message | Expected path |
| --- | --- |
| How do I register as a donor? | RAG answer from published donor documentation |
| How do I create a blood request? | RAG answer from published request documentation |
| What's my wallet balance? | `get_wallet_summary` for the signed-in user |
| Show me my latest transactions. | `get_wallet_summary` |
| What is the status of my blood request? | `get_blood_requests` / `get_blood_request` |
| When is my next appointment? | Published appointment guidance. There is no appointment-list tool; `cancel_booking` is the only booking action |
| Why is my hospital verification still pending? | `get_identity_verification_status`; this is not a hospital approval |
| Can you cancel my request? | No autonomous blood-request cancel. Booking cancel uses `cancel_booking` and stops for confirmation |
| I want to speak to a human. | Deterministic escalation, before the model is called |
| Something the knowledge base does not cover | Escalation for insufficient knowledge, or the rules engine if the model is unavailable |

Emergencies, security reports, clinical questions, and password/OTP requests stay on the deterministic safety path.

## Known limitations

- MongoDB cosine search is for the initial knowledge set, not large-scale vector search.
- Qdrant is prepared behind `VECTOR_STORE=qdrant` but not required.
- Small chat models can still digress; grounding checks and the deterministic fallback remain mandatory.
- Streaming is implemented in the Ollama client but the conversation API still returns one completed bot message per turn.

## Recommended Phase 4 scope

1. Socket.IO live takeover while an LLM turn is in flight.
2. Qdrant as the default production vector store.
3. Evaluation harness for grounded answer quality.
4. Controlled preference updates with stronger confirmation UX.
5. Dedicated inference HA / failover.
