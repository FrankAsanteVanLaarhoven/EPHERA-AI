# ADR 0002 — Authorisation is a verifiable credential, not a string

**Status:** Accepted (not yet implemented)
**Date:** 2026-07-21
**Gate:** G0 decision; G2 implementation

## Context

`AGENTS.md` states that money moves only after cryptographic authorisation,
policy and independent verification. The mechanism that is supposed to carry
that guarantee is a field called `authorisationRef`, threaded from the client
through the payments API into the Temporal workflow and on to the ledger.

It carries no guarantee. The payments activity accepts any string of eight or
more characters. The ledger accepts any non-empty string. Nothing binds the
value to the amount, the recipient, the device, the user or the moment. Nothing
prevents the same value being used twice.

Because it is only a string, every surface produces its own. The mobile app
concatenates one in a mock module, the browser surface builds one from a
timestamp, and the admin console ships a hardcoded literal. All three satisfy
the check. The result is that the platform's single most important control is
decorative on every path that exists today.

This is the defining finding of Gate 0 and the reason no sponsor conversation
can start before it is fixed.

## Decision

An authorisation is a signed assertion over the exact transaction the user
approved, verified server-side before any hold or posting.

1. **Bound.** The signed payload covers, at minimum: transfer id, debit account,
   credit account or recipient reference, amount in minor units, currency, fee,
   and the policy version shown to the user. Changing any field invalidates it.
2. **Verified.** Verification is a signature check against a registered,
   device-bound public key (WebAuthn/passkey assertion, or a native equivalent).
   Presence, length and format checks are not verification.
3. **Single-use.** Each assertion carries a server-issued challenge. The
   challenge is consumed on first use and cannot be replayed. Expiry is short
   and absolute.
4. **Verified once, at the boundary that matters.** The ledger is the authority
   (ADR 0001), so the ledger verifies. Upstream services may pre-check, but the
   ledger must not accept an assertion it has not verified itself.
5. **No shared authoriser identity.** Operator and console actions never reuse a
   customer authorisation path. Privileged actions use the operator's own
   credential with maker-checker (ADR 0007 records the evidence requirement).
6. **Mocks cannot ship.** A mock authoriser is selectable only under an explicit
   sandbox build flag that is off by default and asserted against at build time.

## Consequences

- Passkey registration, key storage and device binding become prerequisites for
  any money movement — this is the bulk of G2.
- The sandbox gets slower to demo. A mock path must still exist, but it becomes
  a build-time decision rather than a runtime default.
- Existing hardcoded references (`passkey_admin_console_demo`, the mock refs,
  the browser timestamp ref) all stop working, by design. Each is a separate
  removal in the register.
- Evidence improves for free: a verified assertion is exactly the artefact G7
  needs to prove a customer authorised a payment.

## Evidence at time of writing

- `services/payments/internal/workflow/activities.go:53-61` — length check only.
- `services/ledger/internal/store/store.go:199-201` — non-empty check only.
- `packages/passkeys/src/index.ts:45,62-64` — mock concatenates a reference;
  `allowMock` defaults to permitting it.
- `apps/mobile/screens/SendScreen.tsx:26`, `apps/mobile/screens/FreezeScreen.tsx:24`
  — mock hardcoded on the live money path.
- `apps/consumer-pwa/src/lib/api.ts:83` — reference built from a timestamp.
- `apps/admin-console/src/app/api/temporal/start/route.ts:35` and
  `apps/admin-console/src/app/api/users/route.ts:29` — hardcoded literal.

Deviations D-01, D-02, D-07, D-31, D-32.
