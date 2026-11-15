#!/bin/sh
# Verify API + LLM after compose up / live update.
# Env:
#   HEALTH_BASE  e.g. http://api:3000/api/v1  (in-compose)
#   LLM_RETRIES  default 90 (~3 min at 2s)
#   HEALTH_RETRIES default 30
set -eu

BASE="${HEALTH_BASE:?Set HEALTH_BASE to the API health root, e.g. http://api:3000/api/v1}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
LLM_RETRIES="${LLM_RETRIES:-90}"

echo "stack-check: API health at $BASE/health"
i=1
while [ "$i" -le "$HEALTH_RETRIES" ]; do
  if curl -sf "$BASE/health" >/dev/null; then
    echo "stack-check: API healthy"
    break
  fi
  if [ "$i" -eq "$HEALTH_RETRIES" ]; then
    echo "stack-check: API health failed after ${HEALTH_RETRIES} attempts" >&2
    exit 1
  fi
  i=$((i + 1))
  sleep 2
done

echo "stack-check: LLM readiness at $BASE/health/llm"
i=1
TMP="$(mktemp)"
while [ "$i" -le "$LLM_RETRIES" ]; do
  code="$(curl -sS -o "$TMP" -w '%{http_code}' "$BASE/health/llm" || echo 000)"
  if [ "$code" = "200" ]; then
    echo "stack-check: LLM OK"
    cat "$TMP"
    echo
    rm -f "$TMP"
    exit 0
  fi
  if [ "$i" -eq "$LLM_RETRIES" ]; then
    echo "stack-check: LLM not ready (HTTP $code) after ${LLM_RETRIES} attempts" >&2
    cat "$TMP" >&2 || true
    echo >&2
    rm -f "$TMP"
    exit 1
  fi
  i=$((i + 1))
  sleep 2
done
