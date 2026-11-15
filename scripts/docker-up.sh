#!/usr/bin/env bash
# Bring up the full stack using only paths inside this app folder.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p .ollama data/mongo data/redis

# Free 11434 so Compose Ollama (./.ollama) owns inference — not host brew.
if command -v brew >/dev/null 2>&1; then
  brew services stop ollama >/dev/null 2>&1 || true
fi
killall Ollama >/dev/null 2>&1 || true
killall ollama >/dev/null 2>&1 || true

echo "Starting Bliiva from $ROOT"
echo "  models:  $ROOT/.ollama"
echo "  mongo:   $ROOT/data/mongo"
echo "  redis:   $ROOT/data/redis"

docker compose \
  --project-directory "$ROOT" \
  -f "$ROOT/docker-compose.yml" \
  up -d --build "$@"

echo "Waiting for API health…"
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:3100/api/v1/health" >/dev/null 2>&1; then
    echo "Ready: http://127.0.0.1:3100/api/v1  (Swagger: http://127.0.0.1:3100/docs)"
    exit 0
  fi
  sleep 2
done

echo "API did not become healthy in time. Recent logs:"
docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" logs --tail=80 api ollama ollama-warm
exit 1
