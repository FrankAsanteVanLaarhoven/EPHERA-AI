#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
export PAYMENTS_HTTP_ADDR="${PAYMENTS_HTTP_ADDR:-:8090}"
cd "$ROOT/services/payments"
go run ./cmd/api
