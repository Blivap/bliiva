# Phase 3 — Self-hosted LLM support agent

Bliiva keeps the Phase 1/2 deterministic engine as the safety net. When `LLM_ENABLED=true`, the orchestrator tries a local Ollama chat model with RAG and allowlisted tools first. If the model is busy, unavailable, timed out, or returns an ungrounded answer, the conversation falls back to the rules engine.

## Local development (8 GB RAM)

1. One-shot stack from the app folder (Mongo, Redis, Ollama, warm model, API + seed):

```bash
yarn docker:up
```

Models live in `./.ollama`. Mongo/Redis use Docker named volumes. The API talks to `http://ollama:11434`. Host Homebrew Ollama should stay stopped so port `11434` is free.

2. `.env` essentials (Compose overrides DB/LLM URLs inside containers):

```env
SEED_ON_START=true
LLM_ENABLED=true
LLM_MODEL=qwen3:1.7b
EMBEDDING_MODEL=nomic-embed-text
RAG_ENABLED=false
```

3. For yarn-only API against compose Ollama:

```bash
docker compose up -d mongo redis ollama ollama-warm
yarn start:dev
# optional RAG: admin POST /api/v1/support/admin/rag/reindex
```

Expected memory: Ollama with Qwen3 1.7B + nomic-embed-text fits an 8 GB laptop when `LLM_MAX_CONCURRENT=1` and `LLM_NUM_CTX=2048`. Qwen3 4B needs more headroom and should not run beside heavy IDE/browser loads.

## Production

Ollama runs beside the API, the same way local Compose does. It is not given a public URL.

- `docker-compose.prod.yml` starts `ollama` and `ollama-warm`. The API uses `http://ollama:11434`. Model files stay on the `bliiva_ollama` volume. Port `11434` is not published.
- On Render, `render.yaml` starts a private service `bliiva-ollama` and sets the API `LLM_BASE_URL` to that service's internal host and port. Sync the Blueprint in the same region as the API.
- Keep `LLM_MODEL=qwen3:4b` only when that Ollama service has about 8 GB of RAM. Development can stay on `qwen3:1.7b`.
- Deploy with `yarn docker:live` (or `docker compose -f docker-compose.prod.yml up -d` then `run --rm stack-check`). The oneshot `stack-check` service (Compose profile `check`) hits `GET /api/v1/health` and `GET /api/v1/health/llm` and fails the update if the boot LLM probe chat did not succeed. It is not started by `up --wait` so oneshot exit 0 cannot fail Compose wait. Local `yarn docker:up` runs the same check against Compose Ollama.
- After stack-check, `yarn docker:up` and CI also run `scripts/smoke-ai-chat.sh`: create a guest conversation, send real prompts, log each `>>>` / `<<<` turn, and fail on empty replies, CoT leaks, or missing expected substrings. Re-run anytime with `yarn docker:smoke-ai` (`SMOKE_PROFILE=ci` for the shorter CI set).

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
