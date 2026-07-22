#!/usr/bin/env bash
set -euo pipefail
# The ledger authenticates its callers; services present this token.
export LEDGER_SERVICE_TOKEN="${LEDGER_SERVICE_TOKEN:-sandbox-service-token}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
export LEDGER_URL="${LEDGER_URL:-http://localhost:8092}"
# The grant-signing public key. The worker verifies a grant's signature before
# it runs a rail, and fails closed without this. Sandbox default is the key
# derived from IDENTITY_SIGNING_SEED=0…01.
export PAYMENTS_AUTH_PUBLIC_KEY="${PAYMENTS_AUTH_PUBLIC_KEY:-${LEDGER_AUTH_PUBLIC_KEY:-4cb5abf6ad79fbf5abbccafcc269d85cd2651ed4b885b5869f241aedf0a5ba29}}"
cd "$ROOT/services/payments"
go run ./cmd/worker
