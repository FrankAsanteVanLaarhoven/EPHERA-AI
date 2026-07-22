#!/usr/bin/env bash
#
# Verify every trust claim EPHERA makes.
#
# The point of this script is that you do not have to believe the documentation.
# Each claim below is checked by running something. Where a claim cannot be
# checked automatically, it says so rather than passing quietly — a verification
# script that reports success for things it never tested would be the same
# defect this platform has spent its gates removing.
#
# Usage:
#   npm run infra:up && npm run db:migrate && npm run db:migrate:identity \
#     && npm run db:migrate:control && npm run db:migrate:compliance
#   ./scripts/verify-trust-claims.sh
#
# Exit code is non-zero if any claim fails.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PG="postgres://ephera:ephera_dev_only@localhost:5433"
# Override where the docker CLI on PATH is a wrapper without compose support.
DOCKER="${DOCKER:-docker}"
PASS=0; FAIL=0; SKIP=0

green() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
red()   { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
grey()  { printf '  \033[33mSKIP\033[0m  %s — %s\n' "$1" "$2"; SKIP=$((SKIP+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

have_pg() { pg_isready -d "$PG/ephera_ledger" >/dev/null 2>&1 || \
            "$DOCKER" compose -f infrastructure/docker-compose.yml exec -T postgres \
              pg_isready -U ephera -d ephera_ledger >/dev/null 2>&1; }

run() { # run <label> <dir> <env-assignments...> -- go test
  local label="$1"; shift
  local dir="$1"; shift
  if (cd "$dir" && env "$@" go test ./... >/tmp/ephera-verify.log 2>&1); then
    local n; n=$(grep -cE '^(ok|---)' /tmp/ephera-verify.log 2>/dev/null || echo 0)
    green "$label"
  else
    red "$label"
    tail -5 /tmp/ephera-verify.log | sed 's/^/        /'
  fi
}

printf '\033[1mEPHERA trust claims — verification\033[0m\n'
printf 'Run at: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'Commit: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# ---------------------------------------------------------------------------
head_ "1. The ledger is the authority for money, and defends its own invariants"
if have_pg; then
  run "double-entry, balance floors, amount validity, grant verification, replay" \
    services/ledger \
    "LEDGER_TEST_DATABASE_URL=$PG/ephera_ledger?sslmode=disable" \
    "LEDGER_SERVICE_TOKEN=verify-token"
else
  grey "ledger invariants" "Postgres is not running; start it with npm run infra:up"
fi

# ---------------------------------------------------------------------------
head_ "2. Authorisation is a credential, not a string"
run "grant format: binding, forgery, replay, expiry, lifetime ceiling" services/authgrant

# ---------------------------------------------------------------------------
head_ "3. A passkey signs the exact transaction"
if have_pg; then
  run "WebAuthn ceremonies, transaction-bound challenges, operator login" \
    services/identity-access \
    "IDENTITY_TEST_DATABASE_URL=$PG/ephera_identity?sslmode=disable"
else
  grey "passkey ceremonies" "Postgres is not running"
fi

# ---------------------------------------------------------------------------
head_ "4. Operators are authenticated, permissioned, and cannot act alone"
if have_pg; then
  run "negative authorisation, maker-checker, hash-chained audit" \
    services/platform-control-bff \
    "CONTROL_TEST_DATABASE_URL=$PG/ephera_operations?sslmode=disable"
else
  grey "operator controls" "Postgres is not running"
fi

# ---------------------------------------------------------------------------
head_ "5. Compliance decides standing; customers do not"
if have_pg; then
  run "KYC/KYB/KYA, evidence-backed tiers, limits, screening, monitoring, fraud" \
    services/compliance-risk \
    "COMPLIANCE_TEST_DATABASE_URL=$PG/ephera_compliance?sslmode=disable"
else
  grey "compliance controls" "Postgres is not running"
fi

# ---------------------------------------------------------------------------
head_ "6. The money path compensates correctly"
run "workflow: failed rail releases the hold, refused auth places none" services/payments

# ---------------------------------------------------------------------------
head_ "7. Shared surfaces"
if npm run test -w @ephera/connect-layer >/tmp/ephera-verify.log 2>&1; then
  green "provider cryptography: HMAC, CSPRNG, constant-time, replay"
else
  red "provider cryptography"
fi
if npm run test -w @ephera/passkeys >/tmp/ephera-verify.log 2>&1; then
  green "browser WebAuthn encoding and failure explanation"
else
  red "browser WebAuthn encoding"
fi

# ---------------------------------------------------------------------------
head_ "7b. Bounded authority, as a standalone module"
if (cd modules/boundedauth && go test ./... -race >/tmp/ephera-verify.log 2>&1); then
  green "credential format, single-use conformance, receipts (race detector on)"
else
  red "boundedauth"
  tail -5 /tmp/ephera-verify.log | sed 's/^/        /'
fi
# The suite is only worth its name if it fails a store that does not satisfy the
# contract, so that is asserted rather than assumed.
if (cd modules/boundedauth && go test ./conformance/... -race -count=3 >/tmp/ephera-verify.log 2>&1); then
  green "the conformance suite fails two deliberately broken stores"
else
  red "conformance suite self-test"
fi
# The reference store, against a real PostgreSQL. What the contract requires is
# a property of the transaction, so an in-memory pass does not establish it.
if have_pg; then
  "$DOCKER" compose -f infrastructure/docker-compose.yml exec -T postgres \
    psql -qtA -U ephera -d postgres -c "CREATE DATABASE boundedauth_ref" >/dev/null 2>&1
  if (cd modules/boundedauth/postgres && \
      BOUNDEDAUTH_TEST_DATABASE_URL="$PG/boundedauth_ref?sslmode=disable" \
      go test ./... -race >/tmp/ephera-verify.log 2>&1); then
    green "the PostgreSQL reference store satisfies the contract, on a real database"
  else
    red "PostgreSQL reference store"
    tail -5 /tmp/ephera-verify.log | sed 's/^/        /'
  fi
else
  grey "PostgreSQL reference store" "Postgres is not running"
fi

# The claim that matters for this platform: the ledger is judged by the same
# contract, using the statement that actually posts money.
if have_pg; then
  if (cd services/ledger && \
      LEDGER_TEST_DATABASE_URL="$PG/ephera_ledger?sslmode=disable" \
      go test ./internal/store/ -race -run BoundedAuthority >/tmp/ephera-verify.log 2>&1); then
    green "EPHERA's ledger satisfies the same contract as an outside implementation"
  else
    red "ledger bounded-authority conformance"
    tail -5 /tmp/ephera-verify.log | sed 's/^/        /'
  fi
else
  grey "ledger bounded-authority conformance" "Postgres is not running"
fi

# A specification nobody else can implement is documentation. This reproduces
# every published vector from an implementation in another language.
if out=$(cd modules/boundedauth && python3 testdata/verify_vectors.py 2>&1); then
  green "test vectors reproduced in a second language ($(printf '%s' "$out" | tail -1))"
else
  red "test vectors not reproducible"
  printf '%s\n' "$out" | tail -5 | sed 's/^/        /'
fi

# ---------------------------------------------------------------------------
head_ "8. Database-level guarantees (not only application code)"
if have_pg; then
  psql_() { "$DOCKER" compose -f infrastructure/docker-compose.yml exec -T postgres \
              psql -qtA -U ephera -d "$1" -c "$2" 2>/dev/null; }

  check() { # check <label> <db> <sql returning t/f>
    local got; got=$(psql_ "$2" "$3" | tr -d '[:space:]')
    if [ "$got" = "t" ]; then green "$1"; else red "$1 (got '${got:-nothing}')"; fi
  }

  # refused runs a statement that MUST fail (e.g. an UPDATE a trigger forbids).
  # It passes only if the database raised. A check that a trigger merely EXISTS
  # would still pass if the trigger body were emptied; this exercises it.
  refused() { # refused <label> <db> <sql that must error>
    if "$DOCKER" compose -f infrastructure/docker-compose.yml exec -T postgres \
        psql -qtA -U ephera -d "$2" -c "$3" >/dev/null 2>&1; then
      red "$1 (the statement succeeded; it should have been refused)"
    else
      green "$1"
    fi
  }

  check "an operator cannot approve their own change" ephera_operations \
    "SELECT count(*)=0 FROM change_requests WHERE decided_by = requested_by;"
  # Exercise the trigger, don't just check it exists. A name-only check would
  # pass even if the trigger body were emptied, and it never touched DELETE
  # (which the append-only claim also covers).
  refused "audit log refuses UPDATE" ephera_operations \
    "UPDATE audit_log SET action='tampered' WHERE id IN (SELECT id FROM audit_log LIMIT 1);"
  refused "audit log refuses DELETE" ephera_operations \
    "DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log LIMIT 1);"
  check "a customer cannot decide their own KYC tier" ephera_compliance \
    "SELECT count(*)=0 FROM tier_decisions WHERE decided_by = subject;"
  check "no journal entry is unbalanced" ephera_ledger \
    "SELECT count(*)=0 FROM (SELECT journal_entry_id FROM postings GROUP BY journal_entry_id, currency
       HAVING sum(CASE WHEN direction='credit' THEN amount_minor ELSE -amount_minor END) <> 0) x;"
  check "no customer wallet is negative" ephera_ledger \
    "SELECT count(*)=0 FROM account_balances b JOIN accounts a ON a.id=b.account_id
       WHERE a.account_type IN ('user_wallet','merchant') AND b.balance_minor - b.hold_minor < 0;"
  # Scoped to entries posted after the control existed, and it says how many
  # predate it. A blanket check would either fail forever on history or, worse,
  # be quietly loosened until it passed — and an invariant edited to fit the
  # data it was meant to police is not an invariant.
  #
  # But scoping to post-control rows means that on a database with no
  # grant-backed transfers the check runs over ZERO rows and passes vacuously —
  # proving nothing while reading as a green PASS. So it first counts how many
  # rows it would actually test. If none, it SKIPs and points at the real proof:
  # the ledger store tests in section 1, which mint a grant, capture, and assert
  # a transfer with no verifiable grant is refused.
  grant_era=$(psql_ ephera_ledger \
    "SELECT count(*) FROM journal_entries je WHERE je.transfer_id LIKE 'tx_%'
       AND je.created_at > (SELECT min(consumed_at) FROM authorisation_grants);" | tr -d '[:space:]')
  if [ "${grant_era:-0}" -gt 0 ]; then
    check "every one of $grant_era grant-era transfers cites a consumed grant" ephera_ledger \
      "SELECT count(*)=0 FROM journal_entries je
         WHERE je.transfer_id LIKE 'tx_%'
           AND je.created_at > (SELECT min(consumed_at) FROM authorisation_grants)
           AND NOT EXISTS (SELECT 1 FROM authorisation_grants g WHERE g.transfer_id = je.transfer_id);"
  else
    grey "grant enforcement on posted transfers" \
      "no grant-era transfers in this database; enforcement is proven by the ledger store tests in section 1, not by historical rows"
  fi
  legacy=$(psql_ ephera_ledger \
    "SELECT count(*) FROM journal_entries je WHERE je.transfer_id LIKE 'tx_%'
       AND je.created_at <= (SELECT min(consumed_at) FROM authorisation_grants);" | tr -d '[:space:]')
  printf '  \033[36mNOTE\033[0m  %s entries predate the authorisation-grant control and cite no grant\n' "${legacy:-0}"
else
  grey "database-level guarantees" "Postgres is not running"
fi

# ---------------------------------------------------------------------------
head_ "9. Claims this script does NOT verify"
cat <<'NOTE'
  These are stated because a verification report that omits them would mislead:

  - No real device has completed a passkey payment on the mobile app. The
    browser path was demonstrated with a virtual authenticator; mobile needs an
    Expo development build.
  - Fraud detection accuracy is unmeasured. There is no labelled fraud data, so
    the scenario benchmark measures agreement with its author, not truth.
  - The screening list is a fixture of fictional entries, not a licensed list.
  - Service-to-service authentication is a shared token, not mutual TLS or
    workload identity.
  - No penetration test, no third-party audit, no load or resilience testing.
  - Console and provider-portal reads still come from in-memory seed data.
NOTE

printf '\n\033[1mResult: %d passed, %d failed, %d skipped\033[0m\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ]
