# Gate G4 — provider and corridor surface

**Scope:** the provider portal's three S1 findings — fake cryptography (D-10),
self-approval minting credentials (D-09), and no tenant isolation (D-08) — plus
the seed record impersonating a real operator (D-30).
**Verdict:** PASS WITH LIMITATIONS — the exposure is closed and the crypto is
real; the registry has not moved to its owning service. See section 9.

## 1. Evidence and assumptions

From the G0 baseline, measured against `apps/provider-portal` and
`packages/connect-layer`:

| Finding | Then |
| --- | --- |
| D-08 | No authentication on any of seven routes. Three returned every provider's legal identity, registration number, tax ID, contacts and compliance documents to any caller |
| D-09 | An applicant could set its own `status` to `approved` through an unrestricted patch merge, or call an unauthenticated admin route. Approval minted a `payments:write` credential and returned the raw secret in the response body |
| D-10 | Cryptography that was not cryptography: a 32-bit unsalted string hash as key derivation, `Math.random()` secrets labelled `eph_sk_live_`, a "HMAC verify" that hashed `secret.timestamp.body` and compared with `!==`, and a declared replay window that recorded nothing |
| D-30 | The seed record named a real licensed operator and shipped pre-approved with licence documents |

The assumption: a provider is a tenant. Everything it can read or write is
scoped to an authenticated subject, and nothing it can do decides its own
regulatory standing.

## 2. Files changed

| File | Change |
| --- | --- |
| `packages/connect-layer/src/security/index.ts` | Rewritten on Web Crypto |
| `packages/connect-layer/src/security/index.test.ts` | New. 14 tests |
| `packages/connect-layer/src/registry.ts` | Applications carry an owning subject |
| `apps/provider-portal/src/lib/session.ts` | New. Ed25519 session verifier |
| `apps/provider-portal/src/app/api/admin/route.ts` | **Deleted** |
| `apps/provider-portal/src/app/api/{applications,compliance,open-banking,swift}/route.ts` | Authenticated; reads scoped to the owner |
| `apps/provider-portal/src/lib/store.ts` | Owner-scoped access; no credential minting on approval; seed de-identified |
| `apps/admin-console/src/components/ProviderCompliancePanel.tsx` | No longer renders a secret into a toast |
| `apps/admin-console/src/lib/store.ts` | Seed de-identified |

## 3. Migrations and schemas

None. The portal's state remains in memory (D-15), which is why the registry
still needs to move to a service that owns it.

## 4. Tests and commands run

| Command | Result |
| --- | --- |
| `npm run test -w @ephera/connect-layer` | ok — 14 tests |
| `npm run typecheck` and `build` for all four applications | ok |
| Route audit: handlers without a session check | only `catalog` and `health` |
| `grep` for a real operator's name in seed data | 0 |

The fourteen tests cover what the previous implementation claimed: secrets are
unpredictable and distinct across 200 issuances; the stored fingerprint is not
the secret and changes with the pepper; a tampered body, a wrong secret, a
replayed request and a skewed timestamp are each rejected for the right reason;
a failed signature does not consume a nonce; adjacent fields cannot be
rearranged into the same signature; expired and revoked credentials are
unusable; sandbox credentials are not labelled live.

## 5. Failures and root causes

Two, both mine:

- `ownerSubject` was added to an `interface` that is declared as a `type`, so
  the field silently did not exist and the portal failed to type-check. Caught
  by `tsc`.
- The first de-identification pass missed `tradingName: "MTN MoMo GH"` and
  three further references in the console's seed data, because the replacement
  matched only the longer forms. A second grep found them. Worth noting because
  "I removed the impersonating name" was briefly true and incomplete at the
  same time.

## 6. Mitigations and residual risks

- **The registry has not moved to its owning service.** Under ADR 0003 the
  provider registry belongs to `corridor-settlement`. It is still a Next.js app
  holding state in memory, so **D-15 remains open here** and the portal's data
  does not survive a restart.
- **Approval has no home yet.** The unauthenticated admin route is deleted and
  the self-approval paths are closed, so nothing can approve a provider at all
  right now. `provider.approve` exists as a control-plane action and returns
  501 because no service owns it. That is the honest state: approval is
  impossible rather than unauthenticated.
- **`catalog` and `health` remain unauthenticated.** The first is static
  regulatory reference data, the second a liveness probe. Neither carries tenant
  data.
- Open banking and SWIFT remain local simulations. They are gated now, but
  gating a simulation does not make it an integration.
- The portal's UI has no sign-in flow, so with the API gated the portal is not
  usable end to end until it obtains a session the way the console does.

## 7. Security and privacy impact

The largest single reduction in this programme so far. An unauthenticated
caller could previously read every provider's legal identity, registration
number, tax ID and contact details, edit another provider's record, approve
itself, and receive a `payments:write` credential in the response. All four are
closed.

The cryptography is now real where it exists and absent where it cannot be:
mutual TLS, key management and envelope encryption are no longer represented by
booleans that nothing reads.

Seed data no longer names a real licensed operator, in the portal or the
console.

## 8. Documentation and runbook changes

The deviation register records D-10 closed and D-08/D-09 partly closed. This
report is new. `PORTAL_SESSION_PUBLIC_KEY` is the portal's new requirement and
fails closed when absent.

## 9. Verdict

**PASS WITH LIMITATIONS.**

D-10 and D-30 are closed. D-08 and D-09 are closed as exposures — no
unauthenticated read, no cross-tenant write, no self-approval, no credential in
a response body — but not as capabilities: the portal cannot approve anything
at all until the registry moves to a service that owns it and `provider.approve`
is wired to the control plane's maker-checker.

### Next

- Move the provider registry into `corridor-settlement` with a real schema,
  then wire `provider.approve` as a control-plane effect so approval requires
  two operators and issues a credential through a channel that is not an HTTP
  response body.
- Give the portal a sign-in flow so it is usable against its own gated API.
