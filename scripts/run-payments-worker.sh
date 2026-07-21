#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
export LEDGER_URL="${LEDGER_URL:-http://localhost:8092}"
cd "$ROOT/services/payments"
go run ./cmd/worker
