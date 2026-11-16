#!/usr/bin/env bash
# Live update: start/replace the API image, then require LLM stack-check.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/local-env.sh"
cd "$ROOT"

COMPOSE=(
  docker compose
  --project-directory "$ROOT"
  -f "$ROOT/docker-compose.prod.yml"
)

echo "Starting live API from $ROOT (image + Mongo/Redis/LLM from .env)"
"${COMPOSE[@]}" up -d "$@"

echo "Waiting for live API health…"
PORT_HOST="${PORT:-2002}"
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT_HOST}/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -sf "http://127.0.0.1:${PORT_HOST}/api/v1/health" >/dev/null 2>&1; then
  echo "Live API did not become healthy. Recent logs:"
  "${COMPOSE[@]}" logs --tail=80 api ollama ollama-warm
  exit 1
fi

echo "Running live stack-check (API + LLM probe via LLM_BASE_URL)…"
"${COMPOSE[@]}" --profile check run --rm --no-deps stack-check

echo "Live stack OK — API on :${PORT_HOST}, LLM verified"
