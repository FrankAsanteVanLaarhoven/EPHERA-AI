# Gate G2-A — authorisation becomes a credential

**Scope:** the first of three G2 increments. The authorisation reference stops
being a string and becomes a signed, transaction-bound, single-use grant that
the ledger verifies itself.
**Exit condition (programme, full G2):** no password-only administration;
negative authorisation tests pass.
**Verdict:** PASS WITH LIMITATIONS — G2-A is complete; G2 is not. See section 9.

## 1. Evidence and assumptions

The G0 baseline named one finding as the defining problem of the programme:
the authorisation reference is a string, not a credential. Reproduced live on
2026-07-21 — an unauthenticated request carrying `authorisationRef: "aaaaaaaa"`
posted a transfer. Every surface manufactured its own: the mobile mock
concatenated one, the browser surface built one from a timestamp, the operator
console shipped a hardcoded literal.

The assumption this gate rests on: a grant is only worth anything if the party
that verifies it is the party that owns the money. Verification therefore
happens in the ledger, not in the payment orchestrator, and offline — a
signature check, so a forgery is refused even when the identity service is
unreachable.

## 2. Files changed

| File | Change |
| --- | --- |
| `services/authgrant/` | New module. Grant format, binding digest, mint and verify, 9 test functions |
| `services/identity-access/` | New service on :8093. Holds the signing key, publishes the public key, mints grants |
| `services/ledger/migrations/005_authorisation_grants.sql` | New. Grant consumption table; evidence records method and grant reference |
| `services/ledger/internal/store/authorisation.go` | New. Grant verification and fail-closed key handling |
| `services/ledger/internal/store/store.go` | Capture verifies and consumes a grant; evidence records the real method |
| `services/ledger/cmd/api/main.go` | Loads the public key; new error mappings |
| `services/ledger/internal/store/integration_test.go` | 6 new authorisation tests; existing tests now mint grants |
| `services/payments/cmd/api/main.go` | New prepare step; transfer requires a prepared id; one fee function |
| `services/payments/internal/workflow/` | Fail-fast binding pre-check replaces the length check; fee fixed at prepare |
| `apps/consumer-pwa/src/lib/api.ts` | Prepare, obtain grant, submit — no longer fabricates a reference |
| `apps/mobile/lib/api.ts`, `lib/config.ts`, `screens/SendScreen.tsx` | Same three-step flow; stable idempotency key |
| `.github/workflows/ci.yml`, `.env.example`, `scripts/run-identity-access.sh`, `package.json`, `docs/runbooks/local-dev.md` | Wiring and documentation |

## 3. Migrations and schemas

`005_authorisation_grants.sql` adds `authorisation_grants`, keyed by the grant
id. Consumption happens in the same transaction as the postings, so a replay
either finds the row or collides on the primary key, and the whole transfer
rolls back. There is no window in which a replayed grant can post.

`authorisation_evidence` gains `grant_jti` and accepts `sandbox_authenticator`
as a method. The method is not disguised as `passkey`: what actually authorised
is what gets recorded (ADR 0009).

## 4. Tests and commands run

| Command | Result |
| --- | --- |
| `go test ./...` in `services/authgrant` | ok — 9 tests including binding tamper cases |
| `go test ./...` in `services/ledger` with a database | ok — 20 tests |
| `go test ./...` / `go vet` in `services/payments` | ok |
| `go build`, `go vet` in `services/identity-access` | ok |
| `./scripts/db-migrate.sh` | 1 applied, 4 already present; re-run a no-op |
| `npm run typecheck` and `build` for consumer-pwa | ok |
| `cargo test`, voice `pytest` | 11 and 4 passed |

### End-to-end, against running services

Identity service on :8093, ledger on :8092 configured with its published key.

| Step | Request | Result |
| --- | --- | --- |
| 1 | Legacy fabricated string `passkey_pwa_1784617797470` | **401** `grant malformed` |
| 2 | Mint grant for 5000 GHS, this transfer id | grant issued |
| 3 | Same grant, amount changed to 90000 | **401** `grant is not bound to this transaction` |
| 4 | Correct transfer with the grant | **posted** |
| 5 | Same grant replayed, fresh idempotency key | **409** `authorisation grant already used` |

Balances moved once and only once. Evidence recorded
`sandbox_authenticator` with a grant reference.

## 5. Failures and root causes

The binding must cover the fee, and the fee was being computed twice — once in
the quote endpoint, once again in the workflow from the rail adapter. A grant
bound to one fee and captured with another would have failed verification for a
legitimate transfer. Fixed by making the fee a single function used by quote,
prepare, binding and capture, which also closes D-19.

Binding to the transfer id forced a real flow change. The client cannot
authorise a transaction the server has not yet defined, so `prepare` now fixes
the transfer id, recipient account and fee before authorisation. That is the
correct shape — a user authorises a determined transaction, not an intention —
and it is the first half of `QUOTED → AWAITING_AUTHORISATION` from ADR 0006.

## 6. Mitigations and residual risks

**The most important limitation, stated plainly: identity-access does not yet
verify a passkey.** The gate in front of minting performs no authenticator
challenge. A grant currently proves that a transaction was bound and has not
been replayed. It does not prove that a human approved it.

This is labelled rather than hidden. Every such grant carries
`sandbox_authenticator` in the grant itself, in the ledger's grant table and in
authorisation evidence, and the minting endpoint returns a warning string and
refuses to run outside a sandbox environment. Anyone reading a transfer's
evidence can tell what did and did not happen.

What is genuinely closed: forgery by any party without the signing key;
repointing a grant to a different amount, recipient, sender, fee or currency;
replay of a spent grant; indefinite validity; and the ledger accepting an
authorisation it has not verified. The ledger fails closed with no key
configured.

Residual risks:

- **D-02 is untouched.** The ledger still authenticates no caller and permits
  any origin. Anonymous callers can no longer forge authorisations, but they can
  still reach the service. Do not expose these ports before G2-C and G8.
- The signing key is an environment variable. It belongs in an HSM or KMS
  (G8). The development seed is committed in `.env.example` and is labelled as
  a development value.
- Freeze and airtime still take an unbound grant: the pre-check confirms a grant
  was supplied and parses, but neither flow binds to one. Freeze changes account
  state and deserves the same treatment.
- The mobile application could not be type-checked here. It is not in the npm
  workspaces and has no typecheck script, so its edits are unverified by any
  tool — a gap that should become a register entry.
- Single-use enforcement depends on the grants table never being pruned.
  Retention must exceed maximum grant lifetime by a wide margin.

## 7. Security and privacy impact

Substantially positive, and narrow. Ed25519 over the exact transmitted payload
bytes, so there is no canonicalisation ambiguity; the binding digest is
length-prefixed, so no rearrangement of adjacent fields collides; unknown
payload fields are refused rather than ignored; lifetime is capped at both mint
and verify.

Grants contain account references and amounts, not personal data. They are
short-lived. The grant table stores what was authorised and when, which is
exactly the evidence G7 needs.

## 8. Documentation and runbook changes

The runbook gains the three-step send flow, the new port, and an explicit
statement of what the sandbox authenticator does and does not prove.
`.env.example` gains the key material with a warning. This report is new.

## 9. Verdict

**PASS WITH LIMITATIONS.**

G2-A is complete: the authorisation boundary exists, is verified by the
authority, and is tested against forgery, repointing and replay both in unit
tests and end-to-end against running services.

G2 as a whole is **not** met. Its exit condition is no password-only
administration and passing negative authorisation tests. The negative tests pass.
Administration is untouched — the operator console still has no server-side
authentication at all.

Remaining G2 work, in order:

- **G2-B — passkey verification.** WebAuthn registration and assertion
  verification in identity-access, so a grant is minted only after a real
  device-bound challenge. Then remove the sandbox authenticator and the mock.
  D-01 closes here, not before.
- **G2-C — operator identity.** `platform-control-bff` with SSO, server-side
  role checks, maker-checker and just-in-time elevation, closing D-06, D-12,
  D-13 and the rest of D-07.

Doing G2-C before G2-B would produce a console that authenticates its operator
and still forwards an unverified customer authorisation, which is the weaker
half of the problem.
