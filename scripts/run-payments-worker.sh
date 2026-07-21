#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
cd "$ROOT/services/payments"
go run ./cmd/worker
