# ADR 0001 — The ledger is the sole authority for balances

**Status:** Accepted
**Date:** 2026-07-21
**Gate:** G0

## Context

Every surface in the platform wants to hold a number and call it a balance: the
mobile home tab, the admin console user table, the provider portal, the offline
queue. Any of those numbers being treated as truth — even for display — produces
a system where two components disagree about how much money exists and neither
can be shown to be right.

The ledger service already implements the correct primitives: double-entry
postings, holds, idempotency keys on both holds and journal entries, row locking
on both sides of a transfer, and a materialised balance updated inside the same
transaction as its postings (`services/ledger/internal/store/store.go`).

## Decision

`services/ledger` is the only component permitted to compute or mutate a balance.

1. No application, cache, provider response, admin console or console operator
   may write a balance. Corrections are new postings, never edits.
2. Every balance shown to a human is a read from the ledger, attributed to a
   read time. A surface that cannot reach the ledger shows *unavailable* — never
   a remembered, defaulted or seeded figure.
3. The ledger enforces its own invariants rather than trusting callers. It is
   the authority, so it validates: amount positivity, currency agreement,
   balanced journal entries, and available funds.
4. The materialised `account_balances` row is a cache of the postings. A
   reconciliation job must be able to rebuild it from `postings` and prove
   equality.

## Consequences

- The `account_balances` non-negative constraint must actually fire. As written
  it is a tautology and never does.
- A per-journal-entry balance check must exist in the database, not only in
  application code, so that a defect in any caller cannot post an unbalanced
  entry.
- Clients get slower and less pretty: no optimistic balance, no seeded default.
  This is the intended trade.
- Rebuild-and-compare becomes a testable property, which is what makes G6
  reconciliation possible at all.

## Evidence at time of writing

- Correct: `services/ledger/internal/store/store.go` — holds, locking, idempotency.
- Deviation D-04: `services/ledger/migrations/001_init.sql` — the non-negative
  available-balance check includes `OR account_id IS NOT NULL`; `account_id` is
  the primary key and is never null, so the constraint is always satisfied.
- Deviation D-05: no constraint or trigger enforces that debits equal credits
  within a journal entry.
- Deviation D-03: `CaptureTransfer` does not validate `amountMinor > 0`; a
  negative amount inverts the posting direction.
- Deviation D-35: `apps/mobile/screens/tabs/HomeTab.tsx` seeds a balance string
  and returns early when the ledger is unreachable, showing a fabricated figure.
