#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="$ROOT/infrastructure/docker-compose.yml"
MIGDIR="$ROOT/services/ledger/migrations"

echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE" exec -T postgres pg_isready -U ephera -d ephera_ledger >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose -f "$COMPOSE" exec -T postgres pg_isready -U ephera -d ephera_ledger

echo "Applying ledger migrations..."
for f in "$MIGDIR"/*.sql; do
  echo " -> $(basename "$f")"
  docker compose -f "$COMPOSE" exec -T postgres \
    psql -U ephera -d ephera_ledger -v ON_ERROR_STOP=1 < "$f"
done

echo "Migrations applied."
