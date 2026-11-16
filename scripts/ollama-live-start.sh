#!/bin/sh
# Render private service. Bind the port Render assigns, pull models onto the
# persistent disk, then keep Ollama in the foreground.
set -eu

port="${PORT:-10000}"
model="${LLM_MODEL:-qwen3:4b}"
embed="${EMBEDDING_MODEL:-nomic-embed-text}"
client="127.0.0.1:${port}"

export OLLAMA_HOST="0.0.0.0:${port}"
ollama serve &
server=$!
trap 'kill "$server" 2>/dev/null || true' TERM INT

i=0
until OLLAMA_HOST="$client" ollama list >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "ollama did not start on port ${port}" >&2
    kill "$server" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo "pulling ${model}"
OLLAMA_HOST="$client" ollama pull "$model"
echo "pulling ${embed}"
OLLAMA_HOST="$client" ollama pull "$embed"

wait "$server"
