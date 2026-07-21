# Gate G2-A and G2-B — authorisation becomes a credential

**Scope:** two of three G2 increments.
**G2-A** — the authorisation reference stops being a string and becomes a
signed, transaction-bound, single-use grant that the ledger verifies itself.
**G2-B** — grants are minted only after a verified WebAuthn passkey assertion
whose challenge is the transaction's binding digest, and the consumer surface
performs that ceremony in the browser.
**Exit condition (programme, full G2):** no password-only administration;
negative authorisation tests pass.
**Verdict:** PASS WITH LIMITATIONS — G2-A and G2-B are complete server-side;
G2 is not. See section 9.

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
| `services/identity-access/migrations/001_identity.sql` | New (G2-B). Credentials, users and single-use ceremony challenges, in a separate database from the ledger |
| `services/identity-access/internal/store/` | New (G2-B). Credential and challenge persistence; public keys only |
| `services/identity-access/internal/passkey/` | New (G2-B). WebAuthn registration and assertion ceremonies |
| `services/identity-access/cmd/api/passkey_routes.go` | New (G2-B). Register, challenge and passkey-mint endpoints |
| `services/identity-access/internal/webauthntest/` | New (G2-B). A software authenticator: real P-256 keys, real attestation and assertion responses |
| `services/identity-access/internal/passkey/passkey_test.go` | New (G2-B). 5 ceremony tests, 8 cases |
| `services/identity-access/cmd/api/ceremony_test.go` | New (G2-B). 7 end-to-end tests over the real HTTP surface against Postgres |
| `packages/passkeys/src/webauthn.ts` + test | New (G2-B). Browser encoding helpers, 7 unit tests |
| `apps/consumer-pwa/src/lib/webauthn.ts` | New (G2-B). The `navigator.credentials` ceremony |
| `apps/consumer-pwa/src/lib/api.ts`, `components/PwaShell.tsx` | Send authorises with a passkey; the result states which path authorised it |
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
| `go test ./...` in `services/identity-access` | ok — 12 tests (5 ceremony, 7 HTTP end-to-end) |
| `npm run test -w @ephera/passkeys` | ok — 9 tests |
| Browser decode against live `register/begin` output | challenge and user id decode to 32 bytes; rp id and user-verification requirement survive |
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

G2-B closes the limitation G2-A left open. A grant with method `passkey` is
minted only after a WebAuthn assertion has been verified against a registered,
device-bound credential — and the challenge that assertion signs is the
transfer's binding digest, so the device signature covers the exact transaction
rather than an opaque value that could be presented for anything else.

What is genuinely closed across both increments: forgery by any party without
the signing key; repointing a grant or an assertion to a different amount,
recipient, sender, fee or currency; replay of a spent grant or a spent
challenge; assertions from a different origin or relying party; assertions
signed by any key other than the registered credential; indefinite validity;
and the ledger accepting an authorisation it has not verified. The ledger fails
closed with no key configured, and the authenticator counter is stored so clone
warnings surface.

The sandbox authenticator still exists so the local demo runs without a
registered credential. It is now **off unless explicitly enabled**, refuses to
run outside a sandbox environment, and is **refused outright for any subject
that has registered a passkey** — a weaker method is never reachable for a user
who has a stronger one. Its grants remain labelled `sandbox_authenticator`
through to evidence.

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
- **The browser ceremony has not been run in a real browser here.** The consumer
  surface is wired, type-checked and built, its encoding layer is unit tested and
  checked against live server output, and the server side is proven by HTTP tests
  driven by a software authenticator. What has not happened in this environment
  is a real `navigator.credentials` call against a real or virtual authenticator,
  because that needs a browser. Treat the browser path as unverified until
  someone completes a ceremony against a running stack.
- **The mobile app still has no passkey.** It calls the sandbox mint endpoint.
  Native passkeys need an Expo development build and a native module; the mock
  now returns an unavailable module rather than silently substituting itself.
- Relying-party identity defaults to `localhost` with development origins. Real
  values are a deployment decision and must be set before any device registers a
  credential it expects to keep working.
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

G2-A and G2-B are complete on the server. The authorisation boundary exists, is
verified by the authority that owns the money, and is tested against forgery,
repointing, replay and origin substitution — in unit tests, in WebAuthn ceremony
tests driven by a software authenticator, and end to end against running
services.

G2 as a whole is **not** met, for two reasons stated plainly:

1. **No ceremony has been completed by a real device.** The browser path is
   wired and the server path is proven, but nobody has yet signed a transfer with
   an actual authenticator, and the mobile app has no passkey at all. D-01 is not
   closed until a real device signs a real transfer.
2. **Administration is untouched.** The gate's exit condition includes no
   password-only administration. The operator console still has no server-side
   authentication at all.

Remaining G2 work, in order:

- **G2-B(iii) — prove it on a device.** Complete a browser ceremony against the
  running stack, then native passkeys in an Expo development build. Then remove
  the sandbox authenticator entirely. D-01 closes here.
- **G2-C — operator identity.** `platform-control-bff` with SSO, server-side
  role checks, maker-checker and just-in-time elevation, closing D-06, D-12,
  D-13 and the rest of D-07.

Doing G2-C before the client work would produce a console that authenticates its
operator and still forwards an authorisation no device ever signed.
