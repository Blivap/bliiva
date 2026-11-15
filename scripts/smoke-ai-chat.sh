#!/usr/bin/env bash
# Smoke-test support AI replies through the local Compose API.
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:3100/api/v1}"
KEY="${SUPPORT_SERVICE_API_KEY:-dev-support-service-key}"
GUEST="ai-smoke-$(date +%s)"

hdr=(-H "x-support-api-key: ${KEY}" -H "x-support-guest-session: ${GUEST}" -H "content-type: application/json")

echo "Health…"
curl -sf "${BASE}/health" >/dev/null

CREATE=$(curl -sf "${hdr[@]}" -d '{}' "${BASE}/support/conversations")
CID=$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d.data.id)' "$CREATE")
echo "Conversation $CID"

send() {
  local msg="$1"
  echo ""
  echo ">>> $msg"
  local resp
  resp=$(curl -sf "${hdr[@]}" \
    --max-time 180 \
    -d "$(node -e 'process.stdout.write(JSON.stringify({content:process.argv[1]}))' "$msg")" \
    "${BASE}/support/conversations/${CID}/messages")
  node -e '
const d = JSON.parse(process.argv[1]);
const content =
  d?.data?.message?.content ??
  d?.data?.botMessage?.content ??
  d?.data?.content ??
  JSON.stringify(d.data ?? d);
console.log("<<<", content);
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
  console.error("FAIL: leaked thinking in reply");
  process.exit(2);
}
if (!String(content).trim()) {
  console.error("FAIL: empty reply");
  process.exit(3);
}
' "$resp"
}

send "hi what are you"
send "do you have a name"
send "what is blivap"
send "alright"
send "that is a lie"
send "write a song for me"

echo ""
echo "AI smoke OK"
