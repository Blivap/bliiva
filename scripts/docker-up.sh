#!/usr/bin/env bash
# Bring up the full local/test stack from this app folder, then verify LLM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/local-env.sh"
cd "$ROOT"

mkdir -p .ollama

# Free 11434 so Compose Ollama (./.ollama) owns inference — not host brew.
if command -v brew >/dev/null 2>&1; then
  brew services stop ollama >/dev/null 2>&1 || true
fi
killall Ollama >/dev/null 2>&1 || true
killall ollama >/dev/null 2>&1 || true

echo "Starting Bliiva from $ROOT"
echo "  models:  $ROOT/.ollama"
echo "  mongo:   docker volume bliiva_mongo_data"
echo "  redis:   docker volume bliiva_redis_data"

docker compose \
  --project-directory "$ROOT" \
  -f "$ROOT/docker-compose.yml" \
  up -d --build "$@"

echo "Waiting for API health…"
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:3100/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -sf "http://127.0.0.1:3100/api/v1/health" >/dev/null 2>&1; then
  echo "API did not become healthy in time. Recent logs:"
  docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" logs --tail=80 api ollama ollama-warm
  exit 1
fi

echo "Running Compose stack-check (API + LLM probe)…"
docker compose \
  --project-directory "$ROOT" \
  -f "$ROOT/docker-compose.yml" \
  --profile check \
  run --rm --no-deps stack-check

echo "Running AI chat smoke (real prompts)…"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
BASE_URL="${BASE_URL:-http://127.0.0.1:3100/api/v1}" \
  SMOKE_PROFILE="${SMOKE_PROFILE:-full}" \
  "$ROOT/scripts/smoke-ai-chat.sh"

echo "Ready: http://127.0.0.1:3100/api/v1  (Swagger: http://127.0.0.1:3100/docs)"

