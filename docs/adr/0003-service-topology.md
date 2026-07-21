# ADR 0003 — Eight deployables, not a microservice estate

**Status:** Accepted
**Date:** 2026-07-21
**Gate:** G0

## Context

The regulated scope ahead — identity, KYC/KYB/KYA, screening, provider registry,
corridor and quoting, safeguarding, settlement, reconciliation, complaints,
evidence — decomposes naturally into dozens of services. Doing that now would
produce an estate no one can run, secure, or reason about, long before there is
a single customer.

Today there are three backend processes (ledger, payments API, payments worker),
one Python intent service, four browser surfaces and one mobile app, with all
console and portal state held in process memory.

## Decision

The platform targets eight deployable services. New capability lands inside one
of them unless there is a stated reason it cannot.

| Deployable | Owns |
| --- | --- |
| `identity-access` | Accounts, sessions, passkeys, device binding, staff SSO, RBAC, step-up |
| `financial-core-ledger` | Accounts, postings, holds, balances. Sole balance authority (ADR 0001) |
| `payment-orchestrator` | Transfer lifecycle, workflows, rail adapters, idempotency |
| `compliance-risk` | KYC/KYB/KYA, screening, monitoring rules, cases, analyst decisions |
| `corridor-settlement` | Corridor and provider registry, quoting and FX, safeguarding, settlement, reconciliation |
| `communications` | Notifications, receipts delivery, customer messaging |
| `voice-intent` | Utterance to typed intent. Proposes only (ADR 0004) |
| `platform-control-bff` | The only backend the consoles talk to. Authentication, authorisation, maker-checker, audit |

### Rules

1. Consoles hold no business state and call no service other than
   `platform-control-bff`. Today they call payments and the provider portal
   directly and keep state in memory; both stop.
2. Each deployable owns its schema. Cross-service reads go through APIs, not
   shared tables.
3. A service boundary exists to hold a trust boundary or a scaling boundary. If
   it holds neither, it is a module, not a service.
4. Splitting a deployable requires an ADR that supersedes this one for that
   service.

## Consequences

- `platform-control-bff` becomes the single place to implement operator
  authentication, RBAC, maker-checker and audit — currently absent everywhere.
- The provider portal stops being a service that mutates its own approval state
  and becomes a surface over `corridor-settlement`.
- Some services stay thin for a long time. That is acceptable; the boundary is
  the deliverable.
- Local development must run eight processes. The compose file and runbook grow
  accordingly.

## Evidence at time of writing

- Existing: `services/ledger`, `services/payments` (api + worker),
  `services/voice-intent`.
- Missing entirely: identity-access, compliance-risk, corridor-settlement,
  communications, platform-control-bff.
- Consoles bypass the intended boundary today:
  `apps/admin-console/src/app/api/temporal/start/route.ts` calls the payments
  API directly; `apps/admin-console/src/app/api/provider-registry/route.ts`
  proxies the provider portal.

Deviations D-08, D-09, D-15, D-17.
