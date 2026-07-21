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
export IDENTITY_DATABASE_URL="${IDENTITY_DATABASE_URL:-postgres://ephera:ephera_dev_only@localhost:5433/ephera_identity?sslmode=disable}"
# The sandbox authenticator mints grants with no authenticator challenge. It is
# enabled here so the local demo runs without a registered passkey, and it is
# refused for any subject that has one. Never set this anywhere else.
export IDENTITY_ALLOW_SANDBOX_AUTHENTICATOR="${IDENTITY_ALLOW_SANDBOX_AUTHENTICATOR:-true}"
cd "$ROOT/services/identity-access"
go run ./cmd/api
