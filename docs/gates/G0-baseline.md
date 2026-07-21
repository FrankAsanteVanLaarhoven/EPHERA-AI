# Gate G0 — current-state baseline

**Scope:** inventory, architecture decision records, trust boundaries.
**Exit condition:** approved current-state baseline.
**Reviewed:** 2026-07-21 against `main` at `459182d`.
**Verdict:** PASS WITH LIMITATIONS — see section 9.

---

## 1. Evidence and assumptions

The whole repository was read: approximately 25,300 lines across eighteen
commits. The money path was read directly — ledger service and store, workflow
and activities, rail adapters, ledger client, migrations, intent compiler, all
shared packages, continuous integration, the compose stack and the run scripts.
The four browser surfaces and the mobile application were inventoried in full.
Every finding rated S1 was re-verified at the file and line before being
recorded.

Assumptions checked and holding: sandbox only, no live funds, no real customer
data, no committed secrets or key material.

Not verified: Go tests could not be executed because the Go toolchain is absent
from the review machine. No service was started; no end-to-end run was observed.
This is the principal evidentiary limitation of this gate.

### What is genuinely built

This matters as much as the gaps, because it determines whether the programme is
worth continuing.

- A real double-entry ledger on Postgres: holds, idempotency keys on both holds
  and journal entries, row locking on both sides of a transfer, and a
  materialised balance updated inside the same transaction as its postings.
- A real durable workflow for domestic transfer with correct compensation — the
  hold is released when the rail fails.
- Rail adapters that are honest simulations. They make no network calls and say
  so in their own documentation.
- A rule-based intent compiler that returns a hard negative on voice-only
  authorisation and classifies risk and clarification need.
- A Rust financial core with eleven passing tests covering balanced journals,
  idempotency, frozen accounts and policy step-up.
- Shared schema packages that encode the right contracts.

The skeleton is the correct shape. The gaps below are gaps in enforcement, not
in conception.

## 2. Surface inventory

| Surface | Port | State | Assessment |
| --- | --- | --- | --- |
| `apps/mobile` | Expo | 16,200 lines | 4 screens reach a backend; 9 are local prototypes; 14 are static mockups. An entire route tree is unmounted |
| `apps/consumer-pwa` | 3006 | 500 lines | Installable, service worker caches shell only. Constructs its own authorisation reference |
| `apps/merchant-web` | 3005 | 200 lines | Not a merchant acceptance application. One form calling a stub, plus a design board |
| `apps/admin-console` | 3007 | 5,100 lines | Nineteen routes, fourteen panels, no server-side authentication, all state in memory |
| `apps/provider-portal` | 3008 | 1,600 lines | Seven routes, six panels, no authentication, no tenant isolation |
| `services/ledger` | 8092 | Go | Correct primitives, no authentication, invariants not enforced in the database |
| `services/payments` | 8090 | Go + workflow | Correct orchestration, authorisation check is a length test |
| `services/voice-intent` | 8091 | Python | Correct boundary; the client calls an endpoint it does not expose |

Absent: identity-access, compliance-risk, corridor-settlement, communications,
platform-control-bff, agent surfaces, operations, compliance and reconciliation
consoles.

## 3. Migrations and schemas

Three ledger migrations exist. No migration was written or applied at this gate.
Two schema defects were found and are recorded as D-04 and D-05:

- The non-negative available-balance constraint includes a disjunct on a primary
  key column, which is never null. The constraint is always satisfied and the
  guarantee does not exist.
- No constraint or trigger enforces that debits equal credits within a journal
  entry. That invariant exists only in the Rust crate, which nothing calls.

Separately, there is no migration tooling: the script replays every file with
stop-on-error and keeps no version table, so it fails on a second run (D-21).

## 4. Tests and commands run

| Command | Result |
| --- | --- |
| `cargo test` in `native/financial-core` | 11 passed, 0 failed |
| Static verification of every S1 finding at file and line | Confirmed |
| Repository scan for committed secrets, key material and attribution | Clean |
| Go tests | Not run — toolchain absent |
| Workspace builds, type-checks and browser application tests | Not run |

## 5. Failures and root causes

Fourteen findings are rated S1. Six of them share one root cause.

**The authorisation reference is a string, not a credential.** The payments
activity accepts any string of eight or more characters; the ledger accepts any
non-empty string. Nothing binds the value to the amount, recipient, device or
moment, and nothing prevents reuse. Because it is only a string, every surface
manufactures its own: the mobile application concatenates one in a mock module
that is hardcoded on the live path, the browser surface builds one from a
timestamp, and the operator console ships a hardcoded literal. All three
satisfy the check. This is the defining finding of the gate — the platform's
most important control is decorative on every path that exists.

The remaining S1 findings fall into three groups:

- **The authority does not defend itself.** The ledger authenticates no caller,
  permits any origin, and does not validate amount positivity; a negative amount
  inverts posting direction. Its two database-level invariants are absent or
  inert.
- **Operator and provider surfaces have no access control.** Nineteen console
  routes and seven portal routes are unauthenticated. The console can move money
  and change ledger account state. A provider can approve itself, which mints a
  payments-write credential and returns the raw secret in the response body.
- **Identity is client-held.** There is no client authentication at all, and KYC
  tier is device storage the customer can edit.

### The systemic pattern

More important than any single item: controls are named, typed, documented and
rendered, but not implemented, and nothing distinguishes the two. A panel
asserts signing, encryption and dual control that do not exist. A role model of
ten roles and twenty-five permissions is enforced by one route in nineteen. A
workflow designer implies it governs money movement; the real path is compiled
Go and never reads it. A kill switch flips flags no service consumes. A screen
tells a customer their money is held as a temporary reserve and will return
within two business hours, having checked neither claim.

A reviewer, an operator or a sponsor reading this repository would materially
overestimate what exists. ADR 0009 exists to close that specific gap, and the
last example is a conduct issue rather than a presentation one.

## 6. Mitigations and residual risks

No mitigations were applied. This gate was read-only by instruction.

**Containment recommended immediately, independent of gate sequencing:** the
operator console and provider portal bind to every interface with no
authentication, and the payment and ledger services accept any origin with no
authentication. These must not be exposed on a shared or untrusted network
before Gate 2. Residual risk today is bounded only by network reachability.

## 7. Security and privacy impact

No real credentials, keys or certificates are committed. Repository attribution
is clean. Two data-handling findings stand:

- Content copied from live worker logs, including a developer workstation
  identifier, is committed as seed data (D-25).
- The seed provider record names a real licensed operator and ships
  pre-approved with licence documents (D-30).

Synthetic personal data is extensive across the mobile application and consoles
and is not behind a demonstration flag, so it is indistinguishable from real
data at a glance. Separately, the repository's commit identity is not the
mandated owner identity (D-28); history has not been rewritten.

## 8. Documentation and runbook changes

Added at this gate:

- `docs/adr/` — nine architecture decision records and an index.
- `docs/gates/G0-baseline.md` — this document.
- `docs/gates/G0-deviation-register.md` — forty-four deviations with evidence.
- `docs/architecture/trust-boundaries.md` — principals, boundaries, data
  classification, network posture and threat restatement.

No existing document was modified. The product documents are the honest part of
the repository: `AGENTS.md`, `docs/product/THESIS.md` and the threat-model
sketch all state the correct rules. The gap is that the code does not implement
them, and the repository README describes an authorisation guarantee that is not
currently true.

## 9. Verdict

**PASS WITH LIMITATIONS** — for the gate, not for the system.

The G0 deliverable is complete and evidence-backed: the inventory, the trust
boundary map, the data classification, the ADR pack and a forty-four item
deviation register. Two limitations attach:

1. No service was executed and no end-to-end run was observed. Findings are
   from code, schema and configuration.
2. Approval of this baseline is the owner's and has not been given. Until it is,
   G0 is not closed.

The finding of the gate is that EPHERA today is a well-shaped prototype whose
authorisation boundary does not exist. The ledger is real. The control
protecting it is a string.

### Recommended entry to G1

G1 is monorepo and environment hardening with a reproducible clean build as its
exit. Two classes of work should be pulled forward into it rather than waiting:

- **Ledger integrity** (D-03, D-04, D-05): amount positivity, a constraint that
  actually fires, and a database-level balanced-entry check. These are ledger
  correctness rather than identity, and they are inexpensive now and expensive
  after data exists.
- **Build truth** (D-11, D-20, D-21): make continuous integration build and
  type-check every application, run the ledger tests, adopt migration tooling
  with a version table, and resolve the orphaned Rust core — either link it into
  the money path or stop reporting its tests as ledger assurance.

Nothing in G1 should touch the authorisation model; that is G2's subject and
requires the passkey and identity work to land together.
