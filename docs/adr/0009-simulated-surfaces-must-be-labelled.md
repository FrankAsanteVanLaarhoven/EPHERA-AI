# ADR 0009 — Simulated data must be distinguishable from attested data

**Status:** Accepted (not yet implemented)
**Date:** 2026-07-21
**Gate:** G0 decision; enforced from G1

## Context

The most consistent finding of the Gate 0 review was not a missing feature. It
was that controls and data are named, typed, documented and rendered, but not
implemented — and nothing on the surface distinguishes the two.

A reviewer, an operator, or a sponsor reading this repository or clicking
through these consoles would materially overestimate what exists. Examples, each
verified:

- A panel labels a provider integration as signed, encrypted and under dual
  control. No signing, encryption or dual control exists; the flags are literals
  in an object.
- A console presents a role model with ten roles and twenty-five permissions.
  One route enforces it.
- A workflow designer implies the pipeline it displays governs money movement.
  The real path is compiled Go; the designer's output is never read.
- A recommendations panel is described as intelligent. It is four conditionals.
- Seeded operational events render in a panel visually identical to the live
  cluster panel, with no way to tell them apart.
- A user table mixes a real ledger balance with seeded balances in the same
  column.
- A screen tells a customer their money is held as a temporary reserve and will
  return within two business hours. Nothing checked either claim.

The last one is the reason this ADR is binding rather than cosmetic: fabricated
assurances to a customer about the location of their money are a conduct issue,
not a presentation issue.

## Decision

1. **Provenance is a field, not a convention.** Any value rendered to a human
   carries whether it is live, cached with an as-of time, modeled, or seeded.
   Surfaces render that distinction visibly.
2. **No fabricated fallback.** When a source is unavailable the surface says so.
   It does not fall back to a seeded, remembered or plausible value. This
   applies to balances, statuses, receipts and provider health alike.
3. **No fabricated assurances.** A surface may not assert a fact about a
   customer's money, a case reference, a timeline, or an authentication method
   unless the system holds that fact.
4. **Controls are labelled by what they do.** A control that is not wired is
   either removed or visibly marked as not in effect. Naming a field
   `requiresMtls` or captioning a panel "dual control" while neither exists is
   prohibited.
5. **Sandbox credentials look like sandbox credentials.** Test material is never
   labelled with production markers.
6. **Documentation states current state.** Roadmap language is marked as
   roadmap. Where a document describes intent, it says so.

## Consequences

- Some consoles will look emptier and less impressive. That is the point: the
  demonstrator's job is to be believed accurately.
- Every deviation in the register that is of the form "displayed as if it
  exists" is closed either by building the control or by relabelling it.
- Seed data is labelled at source, which pairs with ADR 0008 moving it into
  migrations.

## Evidence at time of writing

- `packages/connect-layer/src/swift/index.ts:91-95` — `signed`, `encrypted` and
  `dualControl` are hardcoded literals.
- `packages/connect-layer/src/security/index.ts:34-58` — policy objects
  requiring mutual TLS, allowlists and envelope encryption; referenced nowhere.
- `packages/connect-layer/src/security/index.ts:71` — sandbox secrets carry a
  production marker in the prefix.
- Deviation D-12: `apps/admin-console/src/lib/rbac.ts` — imported by one of
  nineteen routes; the tab permission map is unreferenced.
- Deviation D-10: fake cryptography presented as security controls.
- Deviation D-38: `apps/mobile/screens/FailedPaymentScreen.tsx:50-58` —
  fabricated assurances about customer funds.
- Deviation D-35: `apps/mobile/screens/tabs/HomeTab.tsx:56-64` — fabricated
  balance shown when the ledger is unreachable.
