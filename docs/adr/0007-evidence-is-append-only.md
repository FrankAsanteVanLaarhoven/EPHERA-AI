# ADR 0007 — Evidence and audit are append-only and external to app state

**Status:** Accepted (not yet implemented)
**Date:** 2026-07-21
**Gate:** G0 decision; G7 implementation

## Context

The admin console keeps its audit trail in a module-level array. Records are
unshifted onto the front and the array is truncated in place at two hundred
entries, so history is destroyed silently and without a marker. The actor field
is supplied by the caller and defaults to `superadmin` when absent, so
attribution is not merely weak — it is forgeable, and anonymous actions are
attributed to the highest-privilege identity by default. Nothing is persisted;
a restart erases everything.

The provider portal has the mirror-image problem for evidence: compliance
documents record a fabricated content reference and no bytes. No document can be
re-verified, aged, or produced to a regulator, because no document was ever
stored.

The ledger is better — `authorisation_evidence` rows are written inside the
transfer transaction — but the freeze path discards the error from its evidence
insert, so a freeze can commit while its evidence silently does not.

## Decision

Evidence and audit are a service concern, not an application data structure.

1. **Append-only.** Records are written once. There is no update path and no
   delete path. Corrections are new records that reference the original.
2. **Tamper-evident.** Records are hash-chained: each carries the hash of its
   predecessor within its stream, so a removal or edit is detectable. Export
   includes the chain so a third party can verify it independently.
3. **External.** The store is outside the process that generates the events and
   outside the console that displays them. No operator surface holds the
   authoritative copy of its own audit trail.
4. **Attributed.** The actor is the authenticated principal established by
   `identity-access`. It is never read from a request body and never defaults.
   A record with no authenticated actor is not written — the action is refused.
5. **Complete for sensitive operations.** Every privileged action records actor,
   action, target, before and after values, reason, correlation identifier, time
   and outcome. Failure to write evidence fails the operation; evidence writes
   are not best-effort.
6. **Real artefacts.** Compliance documents store content, a content hash, and
   validity dates. A reference to content that was never stored is not evidence.
7. **Bounded retention is explicit.** Where records age out, the policy is
   stated, the removal is itself recorded, and the retention period meets the
   regulatory floor. Silent truncation to fit an array is not a retention policy.

## Consequences

- Maker-checker (ADR 0003, `platform-control-bff`) has somewhere to record both
  the request and the approval, which is what makes it provable rather than
  procedural.
- Object storage for documents becomes a G7 dependency; the compose stack
  already provides a local implementation.
- The freeze path must fail if its evidence write fails.
- Audit becomes queryable outside the console, which is what an examiner will
  ask for.

## Evidence at time of writing

- Deviation D-14: `apps/admin-console/src/lib/store.ts:1004-1014` — mutable
  array, in-place truncation at 200, caller-supplied actor, no chain, no
  persistence. Reachable by an unauthenticated caller through
  `apps/admin-console/src/app/api/actions/route.ts:42-45`.
- Deviation D-16: `apps/provider-portal/src/app/api/compliance/route.ts:19-26` —
  content reference fabricated from a timestamp; no bytes stored.
- Deviation D-22: `services/ledger/internal/store/store.go:91-95` — the
  authorisation-evidence insert on the freeze path discards its error.
- Correct: `services/ledger/internal/store/store.go:323-329` — evidence written
  inside the capture transaction.
