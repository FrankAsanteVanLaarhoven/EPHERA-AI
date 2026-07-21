#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="$ROOT/infrastructure/docker-compose.yml"

echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE" exec -T postgres pg_isready -U ephera -d ephera_ledger >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose -f "$COMPOSE" exec -T postgres pg_isready -U ephera -d ephera_ledger

echo "Applying ledger migrations..."
docker compose -f "$COMPOSE" exec -T postgres \
  psql -U ephera -d ephera_ledger -v ON_ERROR_STOP=1 \
  < "$ROOT/services/ledger/migrations/001_init.sql"

echo "Migrations applied."
