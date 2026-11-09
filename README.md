# Bliiva — Blivap Intelligent Customer Support API

Standalone NestJS support platform for Blivap. It owns conversations, knowledge, deterministic intent recognition, tickets, and agents. Blivap domain data (users, wallet, donations, blood requests) is accessed through a replaceable **Blivap Integration Port** — this service is called by `blivap-backend` as a third-party API.

There is **no** OpenAI / Gemini / Claude dependency. Phase 2 is a deterministic intent, retrieval, and decision engine. Phase 3 optionally adds a self-hosted Ollama chat model (Qwen3) with RAG and allowlisted tools. When the model is disabled or unavailable, conversations fall back to the Phase 2 engine.

## Stack

- NestJS 12 (ESM) + TypeScript strict
- MongoDB + Mongoose (dedicated `bliiva_support` database)
- Redis + BullMQ (dedicated prefix `{bliiva}`)
- Socket.IO (Phase 4)
- Swagger / OpenAPI
- Vitest + Supertest
- NestJS Observe

## Quick start

```bash
cp .env.example .env
docker compose up -d mongo redis
yarn install --ignore-engines
yarn start:dev
```

- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/docs`

Seed starter intents/knowledge (Mongo must be running):

```bash
yarn seed:support
```

## How Blivap should call this service

1. **Service auth**: send `x-support-api-key` matching `SUPPORT_SERVICE_API_KEY`.
2. **User context**: forward the authenticated Blivap user JWT (or a short-lived support context token). Never trust a `userId` embedded in chat text.
3. Prefer a BFF in `blivap-backend` that proxies `/support/*` so browser apps keep a single origin.

Outbound action calls (Phase 3) use `BLIVAP_API_BASE_URL` + `BLIVAP_SERVICE_API_KEY`. Required Blivap endpoints are documented in [`src/integrations/blivap/blivap.types.ts`](src/integrations/blivap/blivap.types.ts).

## Environment

See [`.env.example`](.env.example). Important:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Support DB only — do not share Blivap app collections |
| `REDIS_DB` / `BULLMQ_PREFIX` | Isolate from Blivap workers |
| `SUPPORT_SERVICE_API_KEY` | Inbound service-to-service key |
| `BLIVAP_API_BASE_URL` | Blivap backend for action reads |
| `AUTO_HANDLE_MIN_CONFIDENCE` | Default `0.85`. Matching score, not a probability |
| `CLARIFICATION_MIN_CONFIDENCE` | Default `0.6` |
| `SUPPORT_USER_JWT_SECRET` | Optional HS256 secret. When set, identity comes from a verified Bearer token (`sub` or `userId`, `roles`) |
| `INTENT_AMBIGUITY_MARGIN` | Default `0.08` |
| `MAX_CLARIFICATION_ATTEMPTS` | Default `2` before escalation |
| `INTELLIGENCE_CACHE_TTL_MS` | Default `15000` for published intents and knowledge |

## Module layout

```
src/
  config/                 # env, database, redis validation
  common/                 # enums, filters, pagination, response helpers
  integrations/blivap/    # BlivapIntegrationPort + Noop client
  redis/
  health/
  support/
    conversations/
    messages/
    knowledge/
    intelligence/         # recognizer, retrieval, context, decision, orchestrator
    actions/              # allowlisted Blivap account actions
    llm/                  # Ollama provider abstraction and prompts
    rag/                  # ingestion, embeddings, MongoDB/Qdrant vector stores
    tools/                # LLM tool registry over the action executor
    agent/                # LLM + RAG + tools turn runner
    escalation/           # ticket creation and staff ticket reads
    tickets/
    agents/
    notifications/
    safety/               # emergency, security, clinical boundaries
    analytics/            # recognition + LLM metrics and redacted failure review
    feedback/
    audit/
```

Self-hosted model setup: [`docs/phase-3-llm.md`](docs/phase-3-llm.md).

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 Foundation | Done | Config, Mongo, Redis, schemas, Swagger, Blivap port |
| 2 Intelligence | Done | Conversations, intents, knowledge, rules engine, decisions, escalation handoff |
| 3 Account actions + self-hosted LLM | Done | Allowlisted Blivap tools, Ollama/Qwen3 agent, RAG, confirmation, ownership checks |
| 4 Realtime | Planned | Socket.IO and live human takeover |
| 5 Hardening | Planned | Broader load tests and production inference HA |

## Scripts

```bash
yarn build
yarn start:dev
yarn test
yarn test:e2e
yarn seed:support
yarn lint
```

## Phase 2 API

All `/support` routes require `x-support-api-key`. Identity is either:

- a verified `Authorization: Bearer` HS256 JWT when `SUPPORT_USER_JWT_SECRET` is set (`roles` on the token decide access; role headers are ignored), or
- trusted forwarding headers from the Blivap BFF when the secret is empty: `x-support-user-id` and `x-support-roles`, or `x-support-guest-session`.

Do not expose header mode on the public internet. The service key is the trust boundary.

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/v1/support/conversations` | User or guest |
| `GET` | `/api/v1/support/conversations/:id` | Owner or staff |
| `GET` | `/api/v1/support/conversations/:id/messages` | Owner or staff |
| `POST` | `/api/v1/support/conversations/:id/messages` | Owner only. Runs the orchestrator |
| `GET` | `/api/v1/support/categories` | Any authenticated caller |
| `GET/POST/PATCH` | `/api/v1/support/admin/intents` | Administrator or supervisor |
| `POST` | `/api/v1/support/admin/intents/test` | Administrator or supervisor |
| `GET/POST/PATCH` | `/api/v1/support/admin/knowledge` | Administrator or supervisor |
| `POST` | `/api/v1/support/admin/knowledge/:id/publish` | Administrator or supervisor |
| `POST` | `/api/v1/support/admin/knowledge/test` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/intelligence/metrics` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/intelligence/failures` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/intelligence/unresolved` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/tickets` | Staff. Agents only see tickets assigned to them |
| `GET` | `/api/v1/support/admin/actions` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/actions/history` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/actions/failures` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/llm/health` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/llm/config` | Administrator or supervisor |
| `GET` | `/api/v1/support/admin/llm/analytics` | Administrator or supervisor |
| `POST` | `/api/v1/support/admin/rag/reindex` | Administrator or supervisor |
| `POST` | `/api/v1/support/admin/rag/test` | Administrator or supervisor |

Account actions call Blivap with the signed-in user's JWT from `x-support-access-token` (or the verified Bearer token when that token is the Blivap JWT). Chat text never supplies the user id. See [`docs/phase-3-integration-map.md`](docs/phase-3-integration-map.md) and [`docs/phase-3-llm.md`](docs/phase-3-llm.md).

User responses do not include matching scores or knowledge ids. Those are stored on the bot message metadata for staff and on the escalation ticket.

### Example flows

1. **Ambiguous account question.** User: "account". Assistant asks whether this is about logging in or creating an account. User: "Logging in." Assistant returns the published sign-in article.
2. **Password reset.** "I forgot my password" and "passwrod reset" both select `PASSWORD_RESET` and return the approved reset steps.
3. **Emergency.** "I have chest pain" immediately returns emergency-service guidance and opens an urgent ticket. The user is told not to wait for chat.
4. **Clinical boundary.** "How does donor eligibility work?" returns the published explanation plus a disclaimer. "Am I eligible to donate?" is escalated and does not approve the donor.
5. **Wallet balance.** "How much do I have in my wallet?" runs `get_wallet_summary` for the signed-in user and returns available/held amounts from Blivap.
6. **Unsupported transfer.** "Transfer money from my wallet" is refused and escalated. No wallet mutation handlers are registered.
7. **Blood request status.** Multiple requests produce a clarification list from the user's own `GET /blood-requests/mine` data before details are shown.

## Migration

Phase 2 only adds fields and one collection. Start the app so Mongoose creates indexes, then re-run the seed:

```bash
yarn seed:support
```

New optional env vars have defaults. Existing conversations keep working. New intent fields (`negativeKeywords`, `priority`, `confidenceThreshold`, `clarificationLabel`) default when missing. New knowledge fields (`phrases`, `priority`, `publishedAt`) do the same. Metrics land in `support_intelligence_events`.

Published answers are not created from unresolved chats. An edit to a published article returns it to draft until an administrator publishes it again.

## Safety notes

- Fail closed: escalate when confidence is low or knowledge is missing.
- Never invent answers.
- No medical diagnosis or eligibility decisions.
- Medical emergencies: fixed emergency guidance + human escalation.
- Do not mutate wallets or approve clinical/hospital verification from the bot.
