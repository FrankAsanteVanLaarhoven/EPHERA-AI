# ADR 0008 — No in-memory state for regulated records

**Status:** Accepted (not yet implemented)
**Date:** 2026-07-21
**Gate:** G0 decision; G1 implementation

## Context

Both operator surfaces keep their entire dataset in module-level JavaScript
arrays. The admin console holds feature flags, users, transactions, mandates,
providers, security challenges, staff and the audit trail this way. The provider
portal holds applications, compliance documents, bank connections, cross-border
messages and issued credentials the same way. The mobile app holds identity and
KYC tier in device storage and lets the user promote their own tier.

Three consequences follow, and all three are disqualifying for a regulated
service:

- **Non-durable.** A restart erases provider approvals, issued credentials,
  compliance decisions and the audit trail. The console's own documentation
  states this.
- **Not multi-instance safe.** Two replicas behind a load balancer disagree
  about whether a provider is approved or a kill switch is engaged. Neither is
  wrong; there is no authority.
- **Not authoritative.** A regulated record that lives on a client, or in one
  process's heap, can be changed by whoever reaches it. Client-held KYC tier is
  the sharpest case: it is a compliance artefact the customer can edit.

The stack for fixing this already exists — Postgres, Redis, NATS and object
storage are all wired into the local compose file and used by no application
except the ledger.

## Decision

1. Any record with regulatory, financial or security significance is persisted
   in a service-owned database with migrations, constraints and backups. This
   includes: identity and KYC state, provider applications and approvals,
   issued credentials, compliance decisions and documents, feature flags,
   mandates, cases, and audit.
2. Process memory is permitted only for caches that can be rebuilt from the
   authoritative store, and for ephemeral request state.
3. Client storage holds preferences and cached projections. It never holds an
   authoritative compliance, limit or entitlement value. A limit that matters is
   enforced server-side; a limit shown on a device is a display of the
   server's value.
4. Every store has a stated durability and concurrency model: how it survives
   restart, and what happens under two concurrent writers. Last-write-wins on a
   blind object merge is not a concurrency model.
5. Control-plane state that gates behaviour — a kill switch above all — is read
   by the services it claims to control. A flag no service reads is not a
   control.

## Consequences

- The consoles lose their standalone demo mode and gain a dependency on
  `platform-control-bff` and its database.
- Seed data moves into migrations, where it can be labelled as seed and excluded
  from non-sandbox environments.
- Client-side identity and limit stores become read-only projections.
- The kill switch has to be genuinely wired to the payment path before it may be
  presented to an operator as a control.

## Evidence at time of writing

- Deviation D-15: `apps/admin-console/src/lib/store.ts`,
  `apps/provider-portal/src/lib/store.ts` — module-level arrays, no database
  dependency in either package manifest.
- Deviation D-17: `apps/admin-console/src/app/api/actions/route.ts:20-32` — the
  kill switch flips in-memory flags that no service reads.
- Deviation D-33: `apps/mobile/screens/IdentityScreen.tsx:105-118` — the user
  writes their own KYC tier to device storage.
- Deviation D-39: `apps/mobile/lib/security-store.ts:52-54` — daily, monthly and
  new-recipient limits are never consulted by the send path.
- Available and unused: Postgres, Redis, NATS and object storage in
  `infrastructure/docker-compose.yml`.
