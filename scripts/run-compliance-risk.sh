#!/usr/bin/env bash
#
# compliance-risk owns customer verification, the limits that follow from it,
# screening and cases. A customer can never decide their own tier.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export COMPLIANCE_DATABASE_URL="${COMPLIANCE_DATABASE_URL:-postgres://ephera:ephera_dev_only@localhost:5433/ephera_compliance?sslmode=disable}"
export COMPLIANCE_HTTP_ADDR="${COMPLIANCE_HTTP_ADDR:-:8095}"
export COMPLIANCE_SERVICE_TOKEN="${COMPLIANCE_SERVICE_TOKEN:-sandbox-service-token}"
cd "$ROOT/services/compliance-risk"
go run ./cmd/api
