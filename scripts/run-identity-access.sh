#!/usr/bin/env bash
#
# identity-access is the only service permitted to mint authorisation grants.
#
# The signing seed is fixed for local development so the ledger's configured
# public key survives a restart. It is a development value and is not a secret
# in any meaningful sense -- never reuse this pattern outside the sandbox.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export IDENTITY_SIGNING_SEED="${IDENTITY_SIGNING_SEED:-0000000000000000000000000000000000000000000000000000000000000001}"
export IDENTITY_HTTP_ADDR="${IDENTITY_HTTP_ADDR:-:8093}"
export EPHERA_ENV="${EPHERA_ENV:-local}"
cd "$ROOT/services/identity-access"
go run ./cmd/api
