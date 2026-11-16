#!/usr/bin/env bash
# Send real support chat prompts and require non-empty AI/rules replies.
# Used by: yarn docker:up, yarn docker:smoke-ai, CI "Smoke AI chat".
#
# Env:
#   BASE_URL                 default http://127.0.0.1:3100/api/v1
#   SUPPORT_SERVICE_API_KEY  default from .env.example placeholder
#   SMOKE_PROFILE            full (default) | ci  (fewer turns for CI time)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/local-env.sh"
BASE="${BASE_URL:-http://127.0.0.1:3100/api/v1}"
KEY="${SUPPORT_SERVICE_API_KEY:-change-me-support-service-key}"
PROFILE="${SMOKE_PROFILE:-full}"
GUEST="ai-smoke-$(date +%s)-$$"
hdr=(-H "x-support-api-key: ${KEY}" -H "x-support-guest-session: ${GUEST}" -H "content-type: application/json")

log() { printf '[smoke-ai] %s\n' "$*"; }
fail() { printf '[smoke-ai] FAIL: %s\n' "$*" >&2; exit 1; }

log "profile=${PROFILE} base=${BASE} guest=${GUEST}"

log "step 1/4 — API health"
health="$(curl -sf --max-time 15 "${BASE}/health")" || fail "GET ${BASE}/health failed"
log "health OK: $(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(d.data??d))' "$health")"

log "step 2/4 — LLM readiness (GET /health/llm)"
llm_code=0
llm_body="$(curl -sS --max-time 120 -o /tmp/bliiva-smoke-llm.json -w '%{http_code}' "${BASE}/health/llm")" || llm_code=$?
if [ "$llm_code" -ne 0 ]; then
  fail "GET ${BASE}/health/llm transport failed (curl exit ${llm_code})"
fi
log "health/llm HTTP ${llm_body}: $(cat /tmp/bliiva-smoke-llm.json)"
if [ "$llm_body" != "200" ]; then
  fail "LLM not ready (HTTP ${llm_body}) — chat smoke requires a working model"
fi

log "step 3/4 — create guest conversation"
CREATE="$(curl -sf --max-time 30 "${hdr[@]}" -d '{}' "${BASE}/support/conversations")" \
  || fail "POST /support/conversations failed (check SUPPORT_SERVICE_API_KEY=${KEY})"
CID="$(node -e 'const d=JSON.parse(process.argv[1]); if(!d?.data?.id) process.exit(1); process.stdout.write(d.data.id)' "$CREATE")" \
  || fail "conversation create response missing data.id: $CREATE"
log "conversation id=${CID}"

send() {
  local msg="$1"
  local expect_substr="${2:-}"
  local started
  started="$(date +%s)"
  log ""
  log ">>> prompt: ${msg}"
  local resp
  if ! resp="$(curl -sf "${hdr[@]}" \
    --max-time 180 \
    -d "$(node -e 'process.stdout.write(JSON.stringify({content:process.argv[1]}))' "$msg")" \
    "${BASE}/support/conversations/${CID}/messages")"; then
    fail "POST .../messages failed for prompt: ${msg}"
  fi
  local elapsed=$(( $(date +%s) - started ))
  node -e '
const d = JSON.parse(process.argv[1]);
const expect = process.argv[2] || "";
const elapsed = process.argv[3];
const content =
  d?.data?.message?.content ??
  d?.data?.botMessage?.content ??
  d?.data?.content ??
  "";
const meta = {
  responseType: d?.data?.responseType ?? d?.data?.type ?? null,
  reason: d?.data?.reason ?? null,
  aiSource: d?.data?.aiSource ?? d?.data?.state?.aiSource ?? null,
};
console.log("[smoke-ai] <<< reply (" + elapsed + "s):", content);
console.log("[smoke-ai]     meta:", JSON.stringify(meta));
const lower = String(content).toLowerCase();
const leak = [
  "understanding what the",
  "the customer",
  "final reply",
  "i will generate",
  "okay, let'\''s start",
  "let'\''s start by",
].some((p) => lower.includes(p));
if (leak) {
  console.error("[smoke-ai] FAIL: leaked thinking in reply");
  process.exit(2);
}
if (!String(content).trim()) {
  console.error("[smoke-ai] FAIL: empty reply");
  process.exit(3);
}
if (expect && !lower.includes(expect.toLowerCase())) {
  console.error("[smoke-ai] FAIL: reply missing expected substring:", expect);
  process.exit(4);
}
' "$resp" "$expect_substr" "$elapsed"
}

log "step 4/4 — chat turns"
send "hi what are you" "bliiva"
send "what is blivap" "blivap"

if [ "$PROFILE" = "full" ]; then
  send "do you have a name" "bliiva"
  send "alright"
  send "that is a lie" "blivap"
  send "write a song for me" "blivap"
fi

log ""
log "AI smoke OK (profile=${PROFILE})"
