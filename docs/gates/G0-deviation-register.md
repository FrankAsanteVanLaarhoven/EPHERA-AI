# G0 deviation register

Baseline commit `459182d`, reviewed 2026-07-21. Every entry was verified at the
named file and line. A deviation is a difference between what the platform
states as a rule (in `AGENTS.md`, `docs/product/THESIS.md`, the ADR pack, or its
own user interface) and what the code does.

## Severity

| Level | Meaning |
| --- | --- |
| **S1** | Blocks any sponsor conversation. The control that is supposed to protect money, identity or evidence does not exist. |
| **S2** | Blocks the gate it belongs to. |
| **S3** | Fix in the normal course of the owning gate. |

Counts: **S1 — 14**, **S2 — 16**, **S3 — 14**, total **44**.

## Register

| ID | Sev | Deviation | Evidence | Gate |
| --- | --- | --- | --- | --- |
| D-01 | S1 | `authorisationRef` is a presence and length check, not a cryptographic authorisation. Not bound to amount, recipient, device or time. Replayable indefinitely | `services/payments/internal/workflow/activities.go:53-61`; `services/ledger/internal/store/store.go:199-201` | G2 |
| D-02 | S1 | Ledger API has no authentication and permits any origin. Direct calls bypass the payment orchestrator and workflow entirely | `services/ledger/cmd/api/main.go:31-44,195-206` | G1/G2 |
| D-03 | S1 | Ledger does not validate that an amount is positive. A negative amount inverts posting direction and moves funds the wrong way | `services/ledger/internal/store/store.go:198-335`; `migrations/001_init.sql` postings check is `<> 0` only | G1 |
| D-04 | S1 | The non-negative available-balance constraint is a tautology (`OR account_id IS NOT NULL` on a primary key) and never fires | `services/ledger/migrations/001_init.sql` | G1 |
| D-05 | S1 | No constraint or trigger enforces that debits equal credits within a journal entry | `services/ledger/migrations/001_init.sql` | G1 |
| D-06 | S1 | Admin console has no server-side authentication on any of its nineteen routes. The only gate is a client-side string compare against a password published in the repository | `apps/admin-console/src/components/AdminShell.tsx:167-176,266-269`; `README.md:228` | G2 |
| D-07 | S1 | Admin console can start real transfers and freeze or unfreeze the live ledger using a hardcoded authorisation literal | `apps/admin-console/src/app/api/temporal/start/route.ts:27-40`; `apps/admin-console/src/app/api/users/route.ts:19-36` | G2 |
| D-08 | S1 | Provider portal has no authentication and no tenant isolation. Three endpoints return every provider's legal identity, contacts and documents to any caller | `apps/provider-portal/src/app/api/{applications,open-banking,swift}/route.ts` | G4 |
| D-09 | S1 | A provider can approve itself: unrestricted patch merge plus an unauthenticated admin route. Approval mints a payments-write credential and returns the raw secret in the response body | `apps/provider-portal/src/app/api/applications/route.ts:57-83`; `api/admin/route.ts:41-49`; `src/lib/store.ts:164-185` | G4 |
| D-10 | S1 | Cryptography presented as controls is not cryptography: a 32-bit unsalted string hash used as key derivation, secrets from a non-cryptographic random source labelled with a production marker, signature verification comparing that hash with a non-constant-time comparison, and no replay or nonce store | `packages/connect-layer/src/security/index.ts:60-104` | G4/G8 |
| D-11 | S1 | The Rust financial core is orphaned. It is the only code enforcing balanced journals, insufficient-funds pre-checks and policy step-up, and nothing calls it. Continuous integration reports it green, which reads as ledger assurance for code outside the money path | `native/financial-core/*`; no library target for linking, zero importers | G1 |
| D-31 | S1 | The browser surface constructs its own authorisation reference from a timestamp, behind a button labelled to imply a real authorisation step. No authoriser module exists in that surface | `apps/consumer-pwa/src/lib/api.ts:83` | G2 |
| D-32 | S1 | All passkeys are the mock implementation. `allowMock: true` is hardcoded on the live money path with no build-time guard preventing it from shipping | `apps/mobile/screens/SendScreen.tsx:26`; `FreezeScreen.tsx:24`; `packages/passkeys/src/index.ts:45,62-64` | G2 |
| D-33 | S1 | KYC tier is client-mutable device storage. The customer promotes their own tier to verified with no server of record | `apps/mobile/screens/IdentityScreen.tsx:105-118`; `lib/identity-store.ts:51` | G3 |
| D-34 | S1 | The idempotency key embeds a timestamp, so every retry or double tap creates a new workflow and a second debit. The unmounted route file uses the correct stable key — this is a regression into the shipped screen | `apps/mobile/screens/SendScreen.tsx:171` against `services/payments/cmd/api/main.go:236` | G1 |
| D-12 | S2 | The role model (ten roles, twenty-five permissions) is imported by one of nineteen routes, and that route derives the actor from the request body, defaulting to the highest privilege. The tab permission map is unreferenced | `apps/admin-console/src/lib/rbac.ts`; `api/staff/route.ts:20,53,56` | G2 |
| D-13 | S2 | No maker-checker, dual approval, break-glass or just-in-time elevation exists anywhere. "Dual control" appears only as interface copy and a hardcoded literal | repository-wide absence; `ProviderCompliancePanel.tsx:330-331`; `packages/connect-layer/src/swift/index.ts:91-95` | G2 |
| D-14 | S2 | The audit trail is a mutable in-memory ring of two hundred entries with a caller-supplied actor, no hash chain, no persistence, and an unauthenticated write path that can flood it | `apps/admin-console/src/lib/store.ts:1004-1014`; `api/actions/route.ts:42-45` | G7 |
| D-15 | S2 | All regulated state — providers, applications, documents, staff, flags, audit — is held in module-level arrays. Non-durable and not multi-instance safe | `apps/admin-console/src/lib/store.ts`; `apps/provider-portal/src/lib/store.ts` | G1 |
| D-16 | S2 | No evidence retention. Compliance documents record a fabricated content reference and store no content, so nothing can be re-verified or produced | `apps/provider-portal/src/app/api/compliance/route.ts:19-26` | G7 |
| D-17 | S2 | The kill switch flips in-memory flags that no service reads. An operator would believe payments were stopped when they are not | `apps/admin-console/src/app/api/actions/route.ts:20-32`; no consumer of the features route | G8 |
| D-18 | S2 | Quote and settlement disagree on who bears the fee. The rail quote reports the recipient receiving amount minus fee; the ledger credits the full amount and debits amount plus fee | `services/payments/internal/adapter/mobilemoney/sim.go:32`; `internal/workflow/activities.go:107-118` | G5 |
| D-19 | S2 | Two sources of fee truth. The payments API recomputes the fee independently of the rail adapter | `services/payments/cmd/api/main.go:164-170` | G5 |
| D-20 | S2 | Continuous integration never builds or type-checks the four browser applications, and only builds — never tests — the ledger service. Voice checks are inlined rather than run from the test file | `.github/workflows/ci.yml` | G1 |
| D-21 | S2 | No migration tooling. The script replays every file with stop-on-error and no version table, so it fails on second run. No down migrations | `scripts/db-migrate.sh`; `services/ledger/migrations/` | G1 |
| D-35 | S2 | A fabricated balance is shown when the ledger is unreachable, and the failure signal is suppressed at the application level | `apps/mobile/screens/tabs/HomeTab.tsx:56-64`; `App.tsx:63-69` | G1 |
| D-36 | S2 | The shipped voice screen performs no check on the compiled intent. The guard exists only in an unmounted file; the rule ships as decorative copy | `apps/mobile/screens/ListeningScreen.tsx:243`; guard at `VoiceScreen.tsx:30-32` | G2 |
| D-37 | S2 | Receipts are fabricated literals — date, fee, provider reference, authentication method — while the real transfer, journal and receipt identifiers returned by the server are displayed once and discarded | `apps/mobile/screens/ReceiptScreen.tsx:26-34`; `SendScreen.tsx:192-201` | G7 |
| D-38 | S2 | The failure screen asserts fabricated facts to the customer about where their money is and when it returns, with a fabricated case reference | `apps/mobile/screens/FailedPaymentScreen.tsx:33,50-58` | G7 |
| D-39 | S2 | Client-side limits — daily, monthly, new-recipient — are never read by the send path. They are display only | `apps/mobile/lib/security-store.ts:52-54` | G3 |
| D-40 | S2 | The offline queue holds authorisation material in process memory and is never flushed anywhere in the repository, so a transfer the customer is told was queued is silently discarded | `apps/mobile/screens/SendScreen.tsx:27,181,206`; `packages/offline-queue` | G6 |
| D-22 | S3 | The freeze path discards the error from its authorisation-evidence insert, so a freeze can commit while its evidence does not | `services/ledger/internal/store/store.go:91-95` | G7 |
| D-23 | S3 | Capture blocks a debit from a frozen account but permits a credit into one | `services/ledger/internal/store/store.go:226-228` | G6 |
| D-24 | S3 | Recipient resolution is a stub. Every recipient name maps to the same account | `services/payments/cmd/api/main.go:269-277` | G5 |
| D-25 | S3 | A developer workstation identifier and content copied from live worker logs are committed as seed data | `apps/admin-console/src/lib/store.ts:169,186,203,219,235,250` | G0 |
| D-26 | S3 | The workflow proxy sends no credentials and forwards a caller-controlled visibility query; the history route exposes workflow payloads to an unauthenticated caller | `apps/admin-console/src/lib/temporal.ts:19-27`; `api/temporal/route.ts:9`; `api/temporal/history/route.ts` | G8 |
| D-27 | S3 | The capability schema package has zero importers despite being the declared capability contract | `packages/capability-schema` | G4 |
| D-28 | S3 | Repository commit identity is not the mandated owner identity | `git log` | G0 |
| D-29 | S3 | All browser applications except the merchant surface bind to every interface with an unrestricted development origin allowance | `apps/*/package.json`; `apps/*/next.config.ts` | G1 |
| D-30 | S3 | The seed provider record names a real licensed operator and ships pre-approved with licence documents | `apps/provider-portal/src/lib/store.ts:22-78` | G4 |
| D-41 | S3 | The client posts to a voice endpoint that does not exist; the 404 is swallowed and a hardcoded intent is substituted | `apps/mobile/lib/api.ts:112` against `services/voice-intent/main.py:37` | G1 |
| D-42 | S3 | An entire route tree is dead code and holds the stricter logic, while roughly eight further screens are unreachable | `apps/mobile/index.js:2-4` | G1 |
| D-43 | S3 | No client authentication of any kind. Every request is anonymous against a hardcoded account reference | `apps/mobile/lib/api.ts:13,47,77`; `apps/consumer-pwa/src/lib/api.ts:12` | G2 |
| D-44 | S3 | Sign-in controls navigate without authenticating, and the security store reports passkeys, biometrics and a transaction PIN as enabled for mechanisms that do not exist | `apps/mobile/screens/WelcomeScreen.tsx:46-58`; `lib/security-store.ts:46-51` | G2 |

## Absent subsystems

Not deviations — capability that does not exist yet, listed so that the baseline
is not mistaken for a partial implementation.

`identity-access`; KYC/KYB/KYA; sanctions and politically-exposed-person
screening; transaction monitoring and alerting; case management; corridor
registry; real quoting and foreign exchange; safeguarding and relevant-funds
allocation; settlement and batch confirmation; three-way reconciliation and
exception ageing; complaints, disputes and refunds; evidence service;
communications service; `platform-control-bff`; agent network.

## State machine gap

Required by the programme brief and adopted in ADR 0006:

```
DRAFT → IDENTITY_PENDING → QUOTED → AWAITING_AUTHORISATION → FUNDED
      → SCREENING → PAYOUT_RESERVED → PAYOUT_AVAILABLE → PAID → SETTLED → RECONCILED
```

Implemented today: an unpersisted sequence of quote, authorisation check, hold,
rail execution, capture and receipt, reduced to a result string of `settled`,
`failed` or `denied`. There is no persisted transfer entity. Screening, payout
reservation, payout availability, settlement and reconciliation do not exist as
concepts. Exception handling is limited to failure and denial.
