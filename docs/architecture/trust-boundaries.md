# Trust boundaries and data classification

Gate 0 baseline, 2026-07-21. Describes the boundaries as they exist today and as
they must exist to certify. Where the two differ, the gap is named.

## 1. Principals

| Principal | Today | Target |
| --- | --- | --- |
| Customer | Unauthenticated. Every request is anonymous against a hardcoded account reference | Authenticated, device-bound, passkey-capable |
| Merchant | Does not exist as a principal | Authenticated business identity, KYB-verified |
| Agent | Does not exist | Authenticated, device- and location-bound, float-limited |
| Provider | Unauthenticated. Any caller can act as any provider | Authenticated organisation, credential-scoped, tenant-isolated |
| Operator (ops, compliance, finance, support) | Does not exist as a distinct principal | SSO identity with role, step-up and maker-checker |
| Super Admin | Client-side password compare; server sees no identity | SSO + hardware factor, just-in-time elevation, no self-approval |
| Voice/intent compiler | Proposes only. Structurally correct at the service, unenforced at the client | Proposes only, enforced both ends |

## 2. Boundaries

### B1 — Client to platform (weakest boundary today)

Everything on the customer side is untrusted input: amounts, recipients, scanned
payloads, intents, device attestations, and above all the authorisation
reference. Today the platform accepts all of it without authenticating the
caller. There is no session, token, cookie or device binding on any client, and
the payment and ledger APIs allow any origin.

**Required:** authenticated sessions, device binding, and server-side
re-derivation of every money-affecting value (ADR 0002, ADR 0004).

### B2 — Application to ledger (the boundary that must never move)

The ledger is the money authority (ADR 0001). Today it enforces holds,
idempotency and locking correctly, but it authenticates no caller, allows any
origin, accepts any non-empty authorisation string, and does not validate that
an amount is positive. Its non-negative balance constraint never fires and no
constraint enforces that a journal entry balances.

**Required:** authenticated service-to-service calls, verified authorisation at
this boundary specifically, and invariants enforced in the database rather than
in callers.

### B3 — Operator to platform

Operator surfaces should hold no business state and reach services only through
`platform-control-bff` (ADR 0003). Today the admin console holds all its state
in memory, has no server-side authentication on any route, calls the payment
service directly with a hardcoded authorisation literal, and proxies the
provider portal without authorising the request.

**Required:** the console becomes a view. Authentication, role checks,
maker-checker and audit all happen behind the boundary, never in the browser.

### B4 — Provider and corridor

Provider data is tenant data. Today three endpoints return every provider's
records to any caller, and a caller can approve its own application — which
mints a credential scoped to write payments and returns the raw secret in the
response body. The cryptography surrounding this is not cryptography: a 32-bit
unsalted string hash serves as key-derivation, secrets come from a
non-cryptographic random source, and signature verification compares that hash
with a non-constant-time string comparison against a value that is not an HMAC.

**Required:** tenant isolation on every read and write, an approval path that
cannot be self-served, real key management, and credential material that is
never returned to an unauthenticated caller.

### B5 — Voice and intent

The intent service holds no credential for, and no route to, money movement, and
returns a hard negative on voice-only authorisation. This boundary is
structurally correct at the service and unenforced at the client that ships.

### B6 — Evidence

Evidence must sit outside the process that generates it and the console that
displays it (ADR 0007). Today the audit trail is a mutable, self-truncating
in-memory array with a caller-supplied actor, and compliance documents store a
reference to content that was never stored.

## 3. Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| **C4 — Authorisation and key material** | Passkey assertions and challenges, provider secrets, signing keys | Never in a client, never in logs, never in an HTTP response body, never in process memory beyond use. Hardware-backed at G8 |
| **C3 — Regulated identity and compliance** | KYC/KYB/KYA evidence, national identifiers, documents, screening results, case notes | Service-owned database, encrypted at rest, access recorded. Never authoritative on a client |
| **C2 — Financial records** | Postings, balances, holds, transfers, mandates, settlement and reconciliation records | Ledger or owning service is authoritative. Append-only where it is evidence |
| **C1 — Customer profile and contact** | Name, phone, email, device list, login history | Service-owned, minimised, encrypted at rest |
| **C0 — Preferences and presentation** | Theme, language, sound, layout | Client storage acceptable |

### Current placement failures

- C4 in a client: authorisation references are constructed on the device and in
  the browser; the mock authoriser is the default on the live money path.
- C4 in a response body: an approval mints a provider secret and returns it to
  an unauthenticated caller.
- C3 on a client: KYC tier and identity documents are held in device storage and
  are user-writable.
- C1 and C2 rendered without authentication: the operator console exposes names,
  phone numbers, KYC levels and balances on an unauthenticated port.

## 4. Network posture (sandbox, today)

| Surface | Port | Bind | Authentication |
| --- | --- | --- | --- |
| Payments API | 8090 | all interfaces | none, any origin |
| Voice intent | 8091 | all interfaces | none, any origin |
| Ledger API | 8092 | all interfaces | none, any origin |
| Consumer PWA | 3006 | all interfaces | none |
| Admin console | 3007 | all interfaces | client-side password only |
| Provider portal | 3008 | all interfaces | none |
| Temporal UI | 8088 | host | none |

Until Gate 2, treat every one of these as unauthenticated and do not expose them
on a shared or untrusted network. The blast radius is bounded only by network
reachability.

## 5. Threats, restated against current code

The Gate 0 sketch in `docs/threat-model/README.md` names the right threats. This
is where each stands today.

| Threat | Stated mitigation | Actual state |
| --- | --- | --- |
| Recorded or synthesised voice authorises | Passkey required for high risk | Not mitigated. Any eight-character string authorises |
| Wrong recipient | Verified display and read-back | Partly. Recipient resolution is a stub that routes every name to one account |
| Replay and double spend | Idempotency keys, workflows | Not mitigated on the client. The key embeds a timestamp, so a retry is a second debit |
| Ledger tampering via app | Server ledger is system of record | Structurally right, but the ledger authenticates no caller |
| Prompt injection into the money path | Typed intent and closed panel library | Types exist; the shipped screen performs no check |
| Offline reconcile failure | Pending until revalidated | Queue is never flushed and is lost on restart |
