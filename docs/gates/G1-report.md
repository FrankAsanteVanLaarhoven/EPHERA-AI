# Gate G1 — ledger integrity and build truth

**Scope:** the two classes of work pulled forward from the G0 baseline —
ledger integrity (D-03, D-04, D-05) and build truth (D-11, D-20, D-21) — plus
D-22, a one-line evidence defect in a function being edited anyway.
**Exit condition (programme):** reproducible clean continuous integration.
**Verdict:** PASS WITH LIMITATIONS — see section 9.

Nothing in this gate touches the authorisation model. That is ADR 0002 and G2,
and it needs the identity work to land with it.

---

## 1. Evidence and assumptions

The G0 baseline recorded four findings as reasoned from code rather than
demonstrated. All four were reproduced against a running ledger and a real
Postgres before any code changed.

Toolchain installed for this gate: Go 1.24.5 (the repository targets 1.22; the
newer toolchain builds it unchanged).

### Reproduction, before the fix

Sandbox seed state: `user:demo-self:GHS` 100000, `user:ama:GHS` 0.

| Step | Request | Result |
| --- | --- | --- |
| 1 | `POST /v1/transfers`, `authorisationRef: "aaaaaaaa"`, no credential of any kind on the request | `{"status":"posted"}` |
| 2 | `POST /v1/transfers`, `amountMinor: -80000` | `{"status":"posted"}` |

Ending state: `self` 130000, `ama` **-30000**.

That single sequence demonstrates four register entries: an arbitrary
eight-character string satisfied the only authorisation gate (D-01); no
authentication existed on the endpoint (D-02); the negative amount inverted the
posting direction and moved funds from the recipient to the sender (D-03); and
a customer wallet was driven below zero past a constraint that was supposed to
prevent it (D-04).

Separately, a one-legged journal entry inserted directly into Postgres was
accepted, confirming that nothing enforced double entry in the database (D-05).

### Assumption corrected

The G0 baseline proposed a blanket non-negative balance rule. That is wrong.
System accounts — clearing, fee, fx, suspense — carry the platform's own
position and legitimately go negative; the sandbox opening balance in migration
003 funds a wallet by debiting clearing. The floor is therefore type-aware, and
there is a test asserting that system accounts *may* go negative, so a future
change cannot quietly tighten it and break funding.

## 2. Files changed

| File | Change |
| --- | --- |
| `services/ledger/migrations/004_ledger_integrity.sql` | New. Positive-amount constraint on postings; type-aware balance-floor trigger; deferred double-entry triggers |
| `services/ledger/internal/store/validate.go` | New. Request validation for holds and transfers |
| `services/ledger/internal/store/validate_test.go` | New. 19 validation cases, no database required |
| `services/ledger/internal/store/integration_test.go` | New. 8 schema-invariant tests against Postgres, skipped when unconfigured |
| `services/ledger/internal/store/store.go` | Validation wired into `PlaceHold` and `CaptureTransfer`; freeze evidence error no longer discarded; comment marking the authorisation check as unverified pending G2 |
| `services/ledger/cmd/api/main.go` | Invalid requests map to 400 with the reason |
| `scripts/db-migrate.sh` | Rewritten as versioned migrations with checksums and drift detection |
| `.github/workflows/ci.yml` | Rewritten. Six jobs covering packages, applications, ledger against Postgres, payments, voice and the specification crate |
| `package.json` | `test:ledger` now runs the ledger's own tests; the crate is `test:financial-core` |
| `native/financial-core/src/lib.rs` | Documents that the crate is not in the money path |
| `docs/runbooks/local-dev.md` | Migration and ledger-test instructions |
| `docs/gates/G0-deviation-register.md` | Status section |

No application, console or client code was changed.

## 3. Migrations and schemas

`004_ledger_integrity.sql`:

1. **`postings.amount_minor > 0`**, replacing `<> 0`. Magnitude belongs in the
   amount; sign belongs in `direction`. This is what made a negative transfer
   representable at all.
2. **Balance floor as a trigger.** The constraint from 001 —
   `CHECK (balance_minor - hold_minor >= 0 OR account_id IS NOT NULL)` — was a
   tautology, because `account_id` is the primary key and is never null. It is
   replaced by `account_balances_nonneg_hold` plus a `BEFORE INSERT OR UPDATE`
   trigger that refuses a negative available balance on `user_wallet` and
   `merchant` accounts while permitting it on system accounts.
3. **Double entry, enforced at commit.** Postings are written one leg at a time,
   so the check is a `DEFERRABLE INITIALLY DEFERRED` constraint trigger: at
   commit, every journal entry must have at least two legs and must net to zero
   for each currency. A second deferred trigger on `journal_entries` catches an
   entry committed with no postings at all, which the postings trigger would
   never see.

Migration tooling now records every applied file in `schema_migrations` with a
SHA-256 checksum. Re-running applies nothing. Editing an applied migration fails
the run rather than silently diverging from what is deployed.

## 4. Tests and commands run

| Command | Result |
| --- | --- |
| `./scripts/db-migrate.sh` on an empty database | 4 applied, 0 skipped |
| `./scripts/db-migrate.sh` again | 0 applied, 4 already present |
| `go test ./...` in `services/ledger` with a database | ok — 8 integration tests, 19 validation cases |
| `go test ./...` in `services/ledger` without a database | ok — integration tests skip cleanly |
| `go vet ./...` in `services/ledger` | clean |
| `go build ./...` and `go test ./...` in `services/payments` | ok |
| `cargo test` in `native/financial-core` | 11 passed |
| `python -m pytest -q` in `services/voice-intent` | 4 passed |
| `npm install` at the workspace root | ok |
| `npm run build` for 9 shared packages | ok |
| `npm run typecheck` for all 4 applications | ok |
| `npm run build` for all 4 applications | ok |
| `npm run test` for validation, passkeys, offline-queue | ok |

Every job in the new continuous integration file corresponds to a command that
was run locally first. None of it is aspirational.

### Verification after the fix

The original exploit, replayed against the rebuilt service:

```
POST /v1/transfers  amountMinor:-80000
HTTP/1.1 400 Bad Request
{"error":"invalid_request","message":"invalid request: amountMinor must be positive, got -80000"}
```

Also rejected: zero amounts, same account on both sides, lowercase currency
codes, missing identifiers, and a fee that would overflow the debit sum. A
legitimate transfer still posts, and balances move correctly.

## 5. Failures and root causes

Two failures during implementation, both mine, both fixed:

- The first migration script ran `psql -f` with a host path inside the database
  container, which cannot see it. Files are now piped on stdin in container
  mode and passed with `-f` in direct mode.
- The script assumed the `docker` on PATH supports `compose`. On this machine it
  is a wrapper that does not. The binary is now overridable with `DOCKER=`.

One design error caught before it shipped: a blanket non-negative balance rule
would have broken the sandbox opening balance, because funding a wallet debits
the clearing account. See section 1.

## 6. Mitigations and residual risks

**The containment recommendation from G0 stands unchanged.** The ledger still
authenticates no caller and still permits any origin. G1 hardened it against
malformed input; it did not give it an identity boundary. Every reproduction in
this report was performed by an unauthenticated caller, and that is still
possible — what changed is that such a caller can no longer post a nonsensical
entry. Do not expose these ports on a shared or untrusted network before G2.

Residual risks:

- **D-01 and D-02 remain open and are the highest-severity items on the
  register.** Nothing in this gate reduces them.
- The database now refuses malformed writes, but a caller that constructs a
  well-formed, balanced entry with a forged authorisation reference is still
  accepted. That is precisely the G2 problem.
- The migration tooling is a shell script. It is adequate for the current
  schema and it fails loudly on drift, but it has no down migrations and no
  advisory locking, so two concurrent runs are not safe. Acceptable while
  deployment is manual; revisit before G8.
- Integration tests create their own accounts rather than reusing seed data, so
  they leave rows behind. Harmless in a sandbox, and they do not interfere with
  each other, but the test database is not self-cleaning.

## 7. Security and privacy impact

Positive and bounded. The ledger now rejects input that could corrupt the
double-entry invariant, and the database enforces that invariant independently
of application code — so a defect in any future caller, including one that
bypasses the payment orchestrator entirely, cannot post an unbalanced or
negative entry.

Evidence integrity improved slightly: a freeze that cannot write its
authorisation evidence no longer commits (D-22, ADR 0007).

No new data is collected, stored or exposed. No secrets were added. No
personal data was introduced. Error messages return the offending field and
value, which is appropriate for a service-to-service boundary and should be
revisited if the ledger ever becomes externally reachable — which it should not.

## 8. Documentation and runbook changes

`docs/runbooks/local-dev.md` gains migration semantics, the `DOCKER=` override,
and how to run the ledger tests with and without a database. The deviation
register gains a status section. The financial-core crate documents its own
position in the architecture. `docs/gates/G1-report.md` is this document.

## 9. Verdict

**PASS WITH LIMITATIONS.**

The gate's stated exit condition — reproducible clean continuous integration —
is met locally for every job, and the ledger integrity work is complete and
tested. Three limitations attach:

1. **Continuous integration has not been observed running on the hosted
   runner.** Every job was verified locally, but nothing has been pushed, so the
   first hosted run is unproven. The Postgres service container and the
   migration step are the parts most likely to need adjustment.
2. **D-11 is relabelled, not resolved.** The crate no longer misrepresents
   itself, and the misleading script name is gone, but the decision of whether
   to link it into the money path, keep it as specification, or retire it is
   still open.
3. **The payments service has no workflow tests.** Its only test file covers one
   rail simulator; the transfer workflow, the activities and the ledger client
   are untested. This was outside the agreed scope and is not in the register
   as a numbered deviation — it should be.

### Recommended entry to G2

G2 is identity, role-based access control and passkeys, with no password-only
administration and passing negative authorisation tests as its exit. The
ordering that matters:

1. `identity-access` and `platform-control-bff` first (ADR 0003), because every
   other control needs somewhere to stand.
2. Real passkey registration and verification, then remove the mock default,
   the browser surface's timestamp reference, and the console's hardcoded
   literal together — leaving any one of them in place keeps D-01 open.
3. Verification at the ledger boundary specifically, since the ledger is the
   authority and must not accept an assertion it has not checked itself.
4. Only then authenticate the consoles. Doing it first would produce a console
   that authenticates its operator and still forwards a forged customer
   authorisation.
