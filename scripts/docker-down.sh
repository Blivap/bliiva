#!/usr/bin/env bash
# Tear down the local Compose stack without depending on external volumes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/local-env.sh"
cd "$ROOT"

docker compose \
  --project-directory "$ROOT" \
  -f "$ROOT/docker-compose.yml" \
  down "$@"
