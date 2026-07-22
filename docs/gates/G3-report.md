# Gate G3 — KYC and compliance foundation

**Scope:** customer verification, the limits that follow from it, screening, and
review cases — owned by a service instead of a device.
**Exit condition (programme):** end-to-end compliance sandbox.
**Verdict:** PASS WITH LIMITATIONS — verification, limits and screening are
enforced; KYB and KYA exist and evidence is real. Behavioural monitoring and an
analyst console do not. See section 9.

## 1. Evidence and assumptions

From the G0 baseline:

| Finding | Then |
| --- | --- |
| D-33 | KYC tier lived in device storage. `IdentityScreen` wrote `{ tier: "verified" }` straight to it, so a tap promoted the customer with no evidence and no decision by anyone |
| D-39 | Daily, monthly and new-recipient limits existed as numbers in a device store that the send path never read |

The assumption: a tier is a statement about evidence someone verified. It is
therefore never set by the subject it describes, and never held anywhere the
subject can write.

## 2. Files changed

| File | Change |
| --- | --- |
| `services/compliance-risk/` | New service on :8095 — schema, rules engine, store, HTTP surface |
| `services/compliance-risk/internal/risk/` | The decision rules, pure and testable. 12 tests |
| `services/compliance-risk/cmd/api/compliance_test.go` | 9 end-to-end tests against Postgres |
| `services/payments/internal/compliance/` | Client; the orchestrator asks before preparing a transfer |
| `services/payments/cmd/api/main.go` | Prepare refuses on deny, holds on review, and fails closed if compliance is unreachable |
| `apps/mobile/screens/IdentityScreen.tsx` | The device no longer decides a tier |
| CI, `.env.example`, run script, runbook, migration script | Wiring |

## 3. Migrations and schemas

`001_compliance.sql` puts the rules that matter in the database:

- **`no_self_verification`** — `decided_by <> subject` on every tier decision.
  The service refuses it too, so a defect in either layer alone cannot produce a
  self-verification.
- **`no_self_clearance`** — an analyst cannot close a case about themselves.
- **`closure_is_complete`** — a closed case must record who closed it and when.
- Tiers carry their limits, so a limit change is a data change with a record
  rather than a constant recompiled into a client.

## 4. Tests and commands run

| Command | Result |
| --- | --- |
| `go test ./...` in `services/compliance-risk` | ok — 27 tests |
| `go test ./...` in `services/payments` | ok |
| Every other service, Rust, Python, connect-layer | ok |

### Demonstrated against the running service

| Step | Result |
| --- | --- |
| Demo customer's tier | `unverified`, single limit `0` |
| Customer verifies themselves | **403** `self_verification_refused` |
| …and directly in the database | refused by constraint |
| Unverified customer sends 250 GHS | `deny` — `tier_cannot_send:unverified` |
| Compliance officer verifies, citing a document | tier `verified` |
| Same payment again | `allow`, `remainingDailyMinor 475000` |
| Paying a screened name | `deny` — `sanctions_match` |

A refused attempt does not consume the daily limit, and a held payment raises a
case so a human has something to work from.

## 5. Failures and root causes

One, mine: the unauthenticated-access test sent `GET` to a `POST`-only route, so
it got 405 from the router and never reached the auth check. The test was
asserting the wrong thing rather than the code being wrong — fixed by using each
route's real method.

## 6. Mitigations and residual risks

- **Document bytes are not stored.** A document record carries a content hash,
  so a document produced later can be shown to be the one verified, but the
  bytes belong in object storage — that is G7. What is closed is the gap that
  mattered: a tier can no longer be raised on evidence nobody has verified.
- **KYB and KYA exist as verification, not as full products.** Businesses and
  agents have subject types, their own tiers, and their own evidence
  requirements. Agent float is a limit, not a managed float ledger; beneficial
  ownership is a verified document, not a modelled ownership graph.
- **Screening is a sandbox fixture.** Three fictional entries, matched by
  case-folded exact comparison. Real screening consumes a licensed list with
  fuzzy matching, and the service says so in its own health response rather than
  leaving it to be assumed.
- **Monitoring is per-payment, not behavioural.** There is no profiling, no
  structuring detection, no network analysis.
- **Cases have no console.** They are raised and closable over the API; no
  compliance console exists to work them.
- The ledger does not consult compliance. The orchestrator does, at prepare, so
  a direct authenticated service call to the ledger would bypass limits. Closing
  that means the ledger consulting compliance itself, as it does for grants.

## 7. Security and privacy impact

Verification state moved off the customer's device and into a service that
authenticates its callers, with the subject unable to decide their own standing.
Every decision is recorded with its reasons, which is what makes a refusal
explainable to the customer and to an examiner.

The compliance database is separate from the ledger, identity and control-plane
databases. It holds names and decisions, so it is the most sensitive store in
the platform after credentials.

## 8. Documentation and runbook changes

The runbook gains the service, its port, its migration, and a plain statement
that the screening list is a fixture. This report is new.

## 9. Verdict

**PASS WITH LIMITATIONS.**

The foundation is real and enforced: a customer cannot verify themselves, an
unverified customer cannot send, limits are applied across payments rather than
displayed on a device, a screened name is refused, and a held payment raises a
case. The payment orchestrator asks before the customer authorises anything, and
treats an unreachable compliance service as a refusal.

KYB and KYA followed, along with the thing that made the first pass weaker than
it looked: a tier decision cited an `evidence_ref` that was a free string, so a
verification could be recorded against evidence nobody had ever seen. A tier now
requires verified, unexpired documents of the kinds that tier demands — which
kinds is data in `tier_requirements`, so changing a requirement is a migration
with a record rather than a recompiled constant. A subject cannot verify their
own document, and tiers do not cross subject types: a business cannot be given a
person's tier.

It is still not an end-to-end compliance sandbox. There is no behavioural
monitoring, no console for analysts to work cases, and the document bytes are
not stored. Those are the rest of G3 and G7.
