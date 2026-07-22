# ADR 0005 — Money is integer minor units end to end

**Status:** Accepted
**Date:** 2026-07-21
**Gate:** G0

## Context

`AGENTS.md` requires integer minor units and forbids floats for balances. The
wire format and the ledger already comply: `amountMinor` is a 64-bit integer in
Go, a `BIGINT` in Postgres, and an integer in the shared schema package.

The client is where it degrades. An intent's integer minor amount is divided by
one hundred into a float, stringified into a text input, then multiplied back by
one hundred and rounded on submit. The value that reaches the wire is an integer
again, so the defect is confined to the client — but the round trip is a real
precision surface and, more importantly, a habit that will escape the client the
moment FX and fee splitting arrive.

There is also a live disagreement about who pays the fee. The rail quote reports
the recipient receiving amount minus fee, while the ledger capture credits the
recipient the full amount and debits the sender amount plus fee. The payments
API additionally recomputes the fee itself rather than using the rail's quote,
so there are two sources of fee truth that can drift.

## Decision

1. Money crosses every boundary as `{ amountMinor: integer, currency: string }`.
   No floats, no decimal strings, no implicit currency.
2. Clients parse user input to an integer minor value once, at the input edge,
   and hold only that integer in state. Formatting for display is a pure
   function of the integer.
3. Rounding happens exactly once, at a named boundary, with a stated rule. FX
   conversion and fee splitting each declare their rounding direction and the
   party that absorbs the remainder.
4. A quote is the single source of fee and rate truth for the transaction it
   describes. Downstream components use the quote; they do not recompute it.
5. A quote states, unambiguously, the debit total and the credit total. Whether
   the fee is borne by sender or recipient is a field, not an inference.

## Consequences

- The send screen must hold an integer and format for display, rather than
  holding a display string and parsing it back.
- Quote generation moves to one place. The payments API stops computing fees
  independently of the rail adapter.
- Quote and capture must be reconciled so that the amount the recipient is told
  they will receive is the amount the ledger credits. This is a prerequisite for
  G5, and a reconciliation break generator if left alone.

## Evidence at time of writing

- Correct: `services/ledger` (`BIGINT`, `int64`),
  `packages/intent-schema/src/index.ts` (`amountMinor`),
  `apps/merchant-web` (takes minor units with an explicit label).
- Deviation: `apps/mobile/screens/SendScreen.tsx:83-87,96` — integer to float to
  string and back.
- Deviation D-18: `services/payments/internal/adapter/mobilemoney/sim.go:32`
  reports receive = amount − fee, while
  `services/payments/internal/workflow/activities.go:107-118` credits the full
  amount and debits amount + fee.
- Deviation D-19: `services/payments/cmd/api/main.go:164-170` recomputes the fee
  independently of the rail adapter.
- `apps/mobile/lib/api.ts:132` hardcodes a currency conversion rate in the client.
