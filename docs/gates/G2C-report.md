# Gate G2-C — operator identity and the control plane

**Scope:** the third G2 increment. Operators authenticate, permissions are
enforced server-side from a signed session, sensitive changes need a second
operator, and the audit trail is append-only and hash-chained.
**Verdict:** PASS WITH LIMITATIONS — the control plane exists and is tested,
operators can obtain sessions with a passkey, and the console's unauthenticated
mutating surface has been removed. The console has not yet been rebuilt against
the control plane. See section 9.

## 1. Evidence and assumptions

The G0 baseline found the operator surface to be the largest concentration of S1
findings. Measured against that surface:

| G0 finding | Then |
| --- | --- |
| D-06 | No server-side authentication on any of 19 routes. The gate was a client-side string compare against a password published in the README |
| D-12 | A 10-role, 25-permission model imported by 1 route in 19, and that route read the actor from the request body, defaulting to super admin |
| D-13 | No maker-checker, dual approval, break-glass or elevation anywhere. "Dual control" existed as interface copy |
| D-14 | Audit was a mutable in-memory array, truncating at 200 entries, actor supplied by the caller, lost on restart |
| D-15 | All operator state in module-level arrays |

The assumption this gate rests on: an operator credential must be at least as
strong as a customer's. Operators therefore authenticate the same way customers
authorise payments — a WebAuthn passkey — and there is no password anywhere in
the service.

## 2. Files changed

| File | Change |
| --- | --- |
| `services/authgrant/session/` | New. Operator session token: signed, role-carrying, 30-minute ceiling. 7 tests |
| `services/platform-control-bff/migrations/001_control_plane.sql` | New. Operators, roles, change requests, append-only hash-chained audit |
| `services/platform-control-bff/internal/authz/` | New. Roles, permissions, and which actions need a second operator |
| `services/platform-control-bff/internal/store/` | New. Persistence, maker-checker, audit chain and chain verification |
| `services/platform-control-bff/cmd/api/` | New. HTTP surface where every route authenticates |
| `services/platform-control-bff/cmd/api/control_test.go` | New. 12 negative authorisation tests |
| `services/identity-access/cmd/api/operator_routes.go` | New (C-ii). Operator login by passkey, minting a session |
| `services/identity-access/migrations/002_operator_sessions.sql` | New (C-ii). Login is a third ceremony type, carrying no transaction binding |
| `apps/admin-console/src/app/api/**` | **All mutating handlers removed**; `temporal/start` deleted outright |
| `apps/admin-console/src/components/AdminShell.tsx` | Password gate removed; mutating helpers explain where the operation went |
| `README.md`, `docs/product/ADMIN-CONSOLE.md` | The published sandbox password is gone |
| `scripts/db-migrate.sh`, `.github/workflows/ci.yml`, `package.json`, `docs/runbooks/local-dev.md` | Wiring |

## 3. Migrations and schemas

`001_control_plane.sql` puts the guarantees in the database, not only in code:

- **`no_self_approval`** — a check constraint that `decided_by <> requested_by`.
  Application code refuses self-approval as well, so a defect in either layer
  alone cannot produce a self-approved change.
- **`applied_requires_approval`** and **`decision_is_complete`** — a change
  cannot be applied without approval, and a decision cannot exist without
  recording who made it and when.
- **`audit_log` is append-only by trigger.** `UPDATE` and `DELETE` raise. An
  operator with direct table access still cannot rewrite history.
- **Hash chain.** Each audit row carries the hash of its predecessor over a
  length-prefixed encoding of every field. `VerifyChain` recomputes from the
  genesis value and reports the first row that does not match.

## 4. Tests and commands run

| Command | Result |
| --- | --- |
| `go test ./...` in `services/authgrant` | ok — 16 tests (9 grant, 7 session) |
| `go test ./...` in `services/platform-control-bff` | ok — 12 tests |
| `go test ./...` in `services/identity-access` | ok — 15 tests (3 new: operator login) |
| `npm run typecheck` and `build` for all four applications | ok |
| `grep` for mutating handlers in the console | 0 remain |
| `grep` for the forged authorisation literal | only in tests asserting it is refused |
| `go vet` in both | clean |
| `./scripts/db-migrate.sh platform-control-bff` | applied; re-run a no-op |

### D-17, demonstrated end to end

Real passkey-derived operator sessions against the running stack:

| Step | Result |
| --- | --- |
| Account before | `active` |
| Maker proposes `wallet.freeze` | change created |
| Maker approves own change | **403** |
| Maker applies before approval | **409**, account still `active` |
| Checker approves | `approved` |
| Maker applies | `applied` |
| **Account after** | **`frozen`** |
| Placing a hold on the frozen account | `account_frozen` |
| Ledger evidence | `operator_session`, operator recorded, change request recorded |
| Ledger freeze with no session / a forged one | **401** |

The account was restored to `active` through the same propose-approve-apply
path afterwards.

### Demonstrated in a real browser

Two operators, two virtual authenticators, real WebAuthn:

| Step | Result |
| --- | --- |
| Maker registers a passkey and signs in | roles `ops_manager` |
| Maker proposes `wallet.freeze` with a reason | status `pending` |
| **Maker sees zero Approve buttons** | cannot approve their own change |
| Checker registers, signs in | roles `approver, ops_manager` |
| Checker approves, then applies | status `applied`, decided by the checker |
| Audit chain | **verified** |

The audit trail from that run, newest first:

```
ops.checker@ephera.internal | passkey | wallet.freeze | applied
ops.checker@ephera.internal | passkey | change.decide | allowed
ops.maker@ephera.internal   | passkey | wallet.freeze | allowed
support.agent@ephera.internal | passkey | wallet.freeze | denied
anonymous                   | none    | wallet.freeze | denied
```

`SELECT count(*) FROM change_requests WHERE decided_by = requested_by` returns 0.

The twelve tests are the gate's exit condition. Each describes something the
previous console permitted:

1. Unauthenticated requests are refused on every route
2. A session signed by anyone but identity-access is refused, however senior the
   roles it claims
3. Roles cannot be self-asserted — a validly signed token claiming
   `ops_manager` gets the roles the database says, and is refused the action
4. The proposer cannot approve their own change
5. …and the database refuses it too, when application code is bypassed entirely
6. Maker-checker happy path: propose, approve by a different operator, apply;
   apply before approval is refused; applying twice is refused
7. A change with no justification is refused
8. A suspended operator is refused immediately, without waiting for expiry
9. The audit chain is intact, and `UPDATE`/`DELETE` on `audit_log` are refused
10. Denied attempts are audited, not silently dropped
11. The audit actor comes from the session; an `actor` field in the body is
    ignored
12. An expired session is refused

## 5. Failures and root causes

Three, all mine, all found by the tests:

- The test helper minted sessions with no roles, which `Mint` refuses. The rule
  is right — a session with no roles authorises nothing, so refusing to mint one
  stops a caller reading "no roles" as "unchecked" — and the helper was wrong.
- The audit chain broke at the first row: the hash covered a nanosecond
  timestamp that Postgres rounds to microseconds. Truncated before hashing.
- The chain then still broke: the hash covered the JSON bytes as written, but
  `jsonb` does not preserve key order or whitespace. Both sides now canonicalise
  through Go's encoder, which sorts keys.

The second and third are worth naming plainly: a hash chain that cannot survive
a round-trip through its own storage is decorative. Both were caught only
because a test verifies the chain rather than assuming it.

## 6. Mitigations and residual risks

- **The console now has a control-plane surface.** Operators sign in with a
  passkey and propose, approve and apply changes through the control plane, with
  the audit chain verified on every load. The legacy tabs still read in-memory
  seed data, so **D-15 remains open for those reads** — they belong to services
  that do not exist yet (customers, transactions, mandates), not to the console.
- The console-level gate is gone entirely rather than replaced. A password box
  that accepted anything, checked in the browser against a value printed on its
  own screen, is worse than no gate: it implies a protection that never existed.
- The password gate is removed rather than replaced. It compared a string in the
  browser against a value printed on the login screen and in the README; the
  server never saw it. Leaving it would have implied protection that never
  existed.
- **Applying a change now performs the effect, for the actions that have an
  owning service.** An approved `wallet.freeze` calls the ledger and the account
  is genuinely frozen (D-17). The ledger verifies the operator's session itself
  and records which approved change authorised it, so the freeze path no longer
  accepts any non-empty string the way capture did before G2-A.
  `kill_switch`, `features.edit`, `provider.approve` and `mandate.change` have
  **no owning service in this codebase**, so applying them returns 501 rather
  than being recorded as applied. The kill switch is still not wired to
  anything — but it now says so instead of reporting success.
- Sessions cannot be revoked before expiry. The 30-minute ceiling bounds the
  exposure; a revocation list is outstanding.
- Break-glass and just-in-time elevation do not exist. Maker-checker covers the
  normal path; the emergency path is unaddressed.

## 7. Security and privacy impact

Strongly positive and narrowly scoped. No password exists anywhere in this
service. Authorisation decisions read from a signed session and the database
only. Every attempt — allowed or denied — is recorded with the authenticated
actor, their authentication method, session id, target, reason and outcome, in
a log the database will not let anyone edit.

The audit trail contains operator identifiers and the targets they acted on,
which is exactly what an examiner needs and exactly what must not leak. It is in
its own database, separate from the ledger.

## 8. Documentation and runbook changes

The runbook gains the service, its port (8094) and its migration step. This
report is new.

## 9. Verdict

**PASS WITH LIMITATIONS.**

The control plane meets the gate's substance: no password-only administration —
no password at all — permissions enforced server-side from a signed session,
maker-checker enforced in both code and schema, and an append-only hash-chained
audit trail with verification. Twelve negative authorisation tests pass.

G2 as a whole still does not close, for one blunt reason: **the console has not
been moved onto it.** A correct control plane that nothing calls does not protect
anything. Until `apps/admin-console` is rewired and its own routes deleted, the
unauthenticated surface described in the G0 baseline is still live.

### Next

- **G2-C(ii) remainder** — rebuild the console against the control plane: an
  operator login, a propose/approve interface, and reads served by the control
  plane rather than an in-memory seed. That closes D-15.
- **G2-C(iii)** — have `apply` call the owning service, so an approved change has
  an effect and the kill switch stops being theatre (D-17).
