#!/usr/bin/env bash
#
# Versioned ledger migrations.
#
# Applies each file in services/ledger/migrations exactly once, in order, inside
# a single transaction, and records it in schema_migrations with a checksum.
# Re-running is a no-op. If an already-applied file has been edited, the run
# fails rather than silently diverging from what is deployed (D-21).
#
# Targets, in order of preference:
#   LEDGER_DATABASE_URL set  -> psql direct (CI, or any reachable database)
#   otherwise                -> docker compose exec postgres (local sandbox)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="$ROOT/infrastructure/docker-compose.yml"

# Each service owns its schema (ADR 0003), so migrations are per service and
# per database. Usage: db-migrate.sh [service] [database]
SERVICE="${1:-ledger}"
DBNAME="${2:-ephera_${SERVICE//-/_}}"
case "$SERVICE" in
  ledger) DBNAME="${2:-ephera_ledger}" ;;
  identity-access) DBNAME="${2:-ephera_identity}" ;;
esac
MIGDIR="$ROOT/services/$SERVICE/migrations"
if [ ! -d "$MIGDIR" ]; then
  echo "No migrations directory for service '$SERVICE' at $MIGDIR" >&2
  exit 1
fi

# Override where the docker CLI on PATH is a wrapper without compose support.
DOCKER="${DOCKER:-docker}"

# A service-specific URL wins; otherwise fall back to the ledger URL with the
# database name swapped, which is how the local stack is laid out.
case "$SERVICE" in
  ledger) DB_URL="${LEDGER_DATABASE_URL:-}" ;;
  identity-access) DB_URL="${IDENTITY_DATABASE_URL:-}" ;;
  *) DB_URL="" ;;
esac

if [ -n "$DB_URL" ] && command -v psql >/dev/null 2>&1; then
  MODE="direct"
  run_sql() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }
  # --single-transaction so a failed migration leaves nothing behind, and so
  # deferred constraint triggers are evaluated at commit.
  apply_file() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$1"; }
  wait_ready() {
    for _ in $(seq 1 30); do
      psql "$DB_URL" -c 'SELECT 1' >/dev/null 2>&1 && return 0
      sleep 1
    done
    echo "Database not reachable for service $SERVICE" >&2
    return 1
  }
else
  MODE="compose"
  run_sql() { "$DOCKER" compose -f "$COMPOSE" exec -T postgres psql -U ephera -d "$DBNAME" -v ON_ERROR_STOP=1 -q "$@"; }
  # The container cannot see host paths, so the file is piped in on stdin.
  apply_file() { run_sql --single-transaction < "$1"; }
  wait_ready() {
    for _ in $(seq 1 30); do
      "$DOCKER" compose -f "$COMPOSE" exec -T postgres pg_isready -U ephera -d "$DBNAME" >/dev/null 2>&1 && return 0
      sleep 1
    done
    echo "Postgres container not ready" >&2
    return 1
  }
fi

echo "Migration target: $MODE · service $SERVICE · database $DBNAME"
wait_ready

run_sql <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

applied=0
skipped=0

for f in "$MIGDIR"/*.sql; do
  version="$(basename "$f" .sql)"
  checksum="$(sha256sum "$f" | cut -d' ' -f1)"

  recorded="$(run_sql -tAc "SELECT checksum FROM schema_migrations WHERE version = '$version'" | tr -d '[:space:]')"

  if [ -n "$recorded" ]; then
    if [ "$recorded" != "$checksum" ]; then
      echo "FAIL: $version was applied with checksum $recorded but the file now hashes to $checksum." >&2
      echo "      Applied migrations are immutable. Add a new migration instead of editing this one." >&2
      exit 1
    fi
    skipped=$((skipped + 1))
    continue
  fi

  echo " -> applying $version"
  apply_file "$f"
  run_sql -c "INSERT INTO schema_migrations (version, checksum) VALUES ('$version', '$checksum')"
  applied=$((applied + 1))
done

echo "Migrations complete: $applied applied, $skipped already present."
