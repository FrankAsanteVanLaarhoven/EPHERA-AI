#!/usr/bin/env bash
set -euo pipefail
# The ledger authenticates its callers; services present this token.
export LEDGER_SERVICE_TOKEN="${LEDGER_SERVICE_TOKEN:-sandbox-service-token}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export LEDGER_DATABASE_URL="${LEDGER_DATABASE_URL:-postgres://ephera:ephera_dev_only@localhost:5433/ephera_ledger?sslmode=disable}"
export LEDGER_HTTP_ADDR="${LEDGER_HTTP_ADDR:-:8092}"
cd "$ROOT/services/ledger"
go run ./cmd/api
