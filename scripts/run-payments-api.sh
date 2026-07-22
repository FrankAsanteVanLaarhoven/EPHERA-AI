#!/usr/bin/env bash
set -euo pipefail
# The ledger authenticates its callers; services present this token.
export LEDGER_SERVICE_TOKEN="${LEDGER_SERVICE_TOKEN:-sandbox-service-token}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
export PAYMENTS_HTTP_ADDR="${PAYMENTS_HTTP_ADDR:-:8090}"
export LEDGER_URL="${LEDGER_URL:-http://localhost:8092}"
cd "$ROOT/services/payments"
go run ./cmd/api
