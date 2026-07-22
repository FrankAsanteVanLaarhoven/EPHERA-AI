# ADR 0006 — One persisted transfer state machine

**Status:** Accepted (not yet implemented)
**Date:** 2026-07-21
**Gate:** G0 decision; G5–G6 implementation

## Context

There is today no persisted transfer entity. A transfer exists as a Temporal
workflow execution, an idempotency key, a journal entry once captured, and a
result string of `settled`, `failed` or `denied`. Receipts live in the worker's
process memory and are lost on restart.

That is enough to demonstrate a send. It is not enough to answer the questions a
regulated corridor is required to answer: where is this payment now, why is it
stuck, has it been screened, has it settled, has it reconciled, and what does
the customer see while it is in flight.

## Decision

Every value transfer is a persisted entity with an explicit state, owned by
`payment-orchestrator`, with the ledger holding the money truth (ADR 0001).

### Primary path

```
DRAFT → IDENTITY_PENDING → QUOTED → AWAITING_AUTHORISATION → FUNDED
      → SCREENING → PAYOUT_RESERVED → PAYOUT_AVAILABLE → PAID → SETTLED → RECONCILED
```

### Exception states

`MANUAL_REVIEW`, `BLOCKED`, `QUOTE_EXPIRED`, `FUNDING_FAILED`, `PAYOUT_FAILED`,
`REFUND_PENDING`, `REFUNDED`, `RECONCILIATION_BREAK`, `DISPUTED`.

### Rules

1. Transitions are explicit, recorded with actor, time, reason and evidence
   reference. There is no implicit transition and no silent terminal state.
2. The state is persisted, not inferred from workflow history. Temporal drives
   the transition; it does not store the answer.
3. `SETTLED` means the provider or bank has confirmed. `RECONCILED` means a
   three-way match against ledger, provider and bank has succeeded. Neither may
   be set optimistically.
4. Money-affecting transitions carry a compensation path. Every state that can
   fail names the state it fails into.
5. The customer-visible status is a projection of this state machine, never an
   independent string. A surface may not assert a status the entity does not
   hold.
6. `RECONCILIATION_BREAK` is entered by the reconciliation process and can be
   left only through an aged, dual-signed resolution (G6).

## Consequences

- Receipts become durable records tied to a transfer, replacing the in-process
  receipt map.
- Screening becomes a first-class state rather than an absent step, which is
  what allows compliance to hold a payment without racing the payout.
- The client can stop fabricating outcome text, because there is a real status
  to render.
- Additional states are cheap to add; removing one requires an ADR.

## Evidence at time of writing

- `services/payments/internal/workflow/domestic_transfer.go` — quote, auth,
  hold, rail, capture, receipt; result strings only.
- `services/payments/internal/workflow/activities.go:121-144` — receipts held in
  a process-local map.
- No `SCREENING`, `PAYOUT_RESERVED`, `PAYOUT_AVAILABLE`, `SETTLED` or
  `RECONCILED` concept exists in any service.
- Deviation D-37: `apps/mobile/screens/ReceiptScreen.tsx:26-34` renders a
  fabricated receipt while the server's real identifiers are discarded.
- Deviation D-38: `apps/mobile/screens/FailedPaymentScreen.tsx:50-58` asserts
  fabricated facts about where the customer's money is.
