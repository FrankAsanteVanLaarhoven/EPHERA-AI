# Design proposal: money-path ordering and settlement

**Status: Option A IMPLEMENTED (commit pending). Option B awaiting decision.**

Update: the signature-before-rail step (Option A / H1) has been implemented and
tested — `RequireAuthorisation` now verifies the grant signature and binding
before any hold or rail, and fails closed with no key configured. A forged-
signature grant is refused before the rail, proven by a test. Option B (the
capture-before-rail settlement reorder, which fully closes H2) still needs the
decision below.

This is the one red-team finding I did not fix in place, because the correct fix
changes settlement semantics and should be agreed before it is written. It
covers three coupled findings:

- **H1 — DONE.** ~~the irreversible rail executes before the grant signature is verified.~~ Fixed: signature verified before the rail, fail-closed, tested.
- **H2** — a capture failure does not release the hold (compensation gap).
- **H8** (related) — the rail adapter ignores the idempotency key, so a retry can
  pay twice.

---

## 1. What happens today

`services/payments/internal/workflow/domestic_transfer.go`, in order:

1. `Quote`
2. `RequireAuthorisation` — checks the grant's **binding** only, via
   `authgrant.ParseUnverified`. **The signature is not checked here.**
3. `PostLedgerHold` — reserve the funds.
4. `ExecuteRail` — **the irreversible payout to the recipient.** Calls
   `RequireAuthorisation` again — still binding-only, still no signature.
5. `CaptureLedger` — the ledger verifies the grant **signature** for the first
   time, consumes it, and posts the double-entry.

### The failure

A client that knows the transfer fields can compute the correct binding digest
(the algorithm is public SHA-256) and submit a grant with that binding and a
**forged signature**. Steps 2 and 4 pass. The rail pays the recipient. Only at
step 5 does the ledger reject the forged signature — and step 5's error path
returns `"failed"` **without releasing the hold**.

Terminal state against a live rail: recipient paid, sender's funds stuck in a
hold that is never released, and no ledger record of any of it. In the sandbox
the rail is simulated, so no money is lost today — but the code is wrong for a
real rail, which is what "production-ready" has to mean.

The ordering is backwards: **the irreversible action runs before the authority
for it is verified, and before the funds are actually moved on the ledger.**

---

## 2. Options

### Option A — verify the signature before the rail (minimal, defense-in-depth)

Make `RequireAuthorisation` verify the **signature**, not just the binding, by
giving the payments worker the identity service's public key (it is public; the
ledger already holds it as `LEDGER_AUTH_PUBLIC_KEY`). Fail closed if no key is
configured.

- **Closes:** the forged-signature-reaches-the-rail hole (H1). A forged grant is
  now rejected at step 2, before any hold or payout.
- **Does not close:** H2 fully. A capture can still fail for a non-forgery
  reason (a genuine replay of a grant already consumed by a concurrent workflow,
  or a transient database error) *after* the rail has paid. Releasing the hold
  there is still wrong for a live rail, because the money already left.
- **Effort:** small. One activity change, one config value, a test.
- **Risk:** low. Additive; the ledger still verifies authoritatively at capture.

### Option B — capture before the rail (correct, larger)

Reorder so the ledger capture (verify signature, consume grant, debit the
sender into a **settlement suspense account**) happens *before* the rail payout.
The rail then pays out of settlement. On rail failure, a **compensating ledger
entry** refunds the sender from settlement.

```
quote → verify(sig) → hold → CAPTURE (debit sender → settlement, consume grant)
      → rail payout (from settlement) → receipt
      on rail failure after capture: reverse (settlement → sender)
```

- **Closes:** H1 and H2 completely. Money never leaves before the ledger has
  authoritatively recorded it; a rail failure is a bounded reversal, not a
  stranded hold.
- **Requires:**
  - A **settlement suspense account** per currency in the ledger (a system
    account the platform's own position flows through).
  - A **reversal / refund** ledger operation (a compensating double-entry that
    the ledger does not have today).
  - Rail-adapter **idempotency** (H8): the rail must treat the idempotency key as
    the dedup key so a Temporal retry cannot pay twice.
- **Effort:** medium. New ledger migration (settlement account), new store method
  (reversal), workflow reorder, adapter idempotency, and tests for each partial-
  failure state.
- **Risk:** medium. It changes what the ledger records for every payment
  (a two-step post: capture-to-suspense, then settle-out) and needs careful
  compensation tests. But it is the design a payment institution expects.

---

## 3. Recommendation

**Do both, in order: Option A now, Option B as the settlement work.**

Option A is small, purely additive, and closes the most alarming clause (a
forged authorisation reaching an irreversible payout) immediately. It is safe to
ship on its own.

Option B is the real fix and should be the next money-path milestone, because
until money moves on the ledger *before* the rail, a rail failure after payout
has no clean compensation. It is genuinely a settlement-model decision — mainly:
**do we introduce a settlement suspense account and a reversal entry, or do we
treat the rail as the point of no return and require the ledger capture to be
the last step that can fail?** That choice is yours, and it interacts with how
reconciliation and provider settlement will work, which is why I have not made
it unilaterally.

---

## 4. The decision I need

1. ~~**Approve Option A now?**~~ **Done** — signature verified before the rail,
   fail-closed, tested.
2. **For Option B, which settlement model:**
   - (a) Settlement suspense account + reversal entry (capture-before-rail, full
     H1/H2 closure), or
   - (b) Keep hold→rail→capture but make capture the only failable step after the
     rail by pre-validating everything capture needs before the payout (narrower,
     avoids a reversal path but leaves a smaller residual window).
3. **Confirm rail idempotency (H8)** is in scope for the settlement work, since
   Option B is unsafe without it.

Option A is implemented and tested. On your answer to (2) I will scope Option B
as its own milestone with migrations, compensation tests, and a rollback plan.

---

## 5. Related, same decision boundary

- **M3** — `holdId` is not covered by the grant binding, and capture does not
  check the hold belongs to the sender. It should be fixed as part of the
  capture rework (bind the hold, or validate `holdAcct == from`), so it is listed
  here rather than patched separately.
- **Kill-switch staleness** — `SendsAllowed` continues to allow payments
  indefinitely on a stale "running" value when the control plane is unreachable.
  This is a *deliberate* asymmetry (stopped-stays-stopped; running-continues),
  and TRUST.md's actual claim is only about the stopped case, so it is not a
  false claim. But whether "running forever on stale data" is acceptable, or
  should flip to closed after a hard bound, is a policy decision worth taking
  alongside the settlement model.
