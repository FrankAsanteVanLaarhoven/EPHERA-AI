# What EPHERA claims, and how to check it

This document exists because "trust us" is not a security property.

Every claim below has a command next to it. If a claim cannot be checked by
running something, it is in the **Not claimed** section instead. Nothing appears
in both.

```bash
npm run infra:up
npm run db:migrate && npm run db:migrate:identity \
  && npm run db:migrate:control && npm run db:migrate:compliance
./scripts/verify-trust-claims.sh
```

The script exits non-zero if any claim fails. It also prints, every run, a list
of things it does **not** verify — a verification report that quietly omits its
own gaps is the defect this platform spent its gates removing.

---

## The one-sentence version

Money moves only after a device-bound passkey signs a signed assertion over the
exact transfer, verified by the ledger itself, consumed once, and recorded as
evidence — and the platform can demonstrate each of those clauses on demand.

---

## Verified claims

| # | Claim | Verified by |
| --- | --- | --- |
| 1 | The ledger validates its own inputs and enforces double entry, balance floors and amount validity in the **database**, not only in application code | `services/ledger` tests + schema checks |
| 2 | An authorisation is a signed, transaction-bound, single-use credential. Forgery, repointing to a different amount or recipient, and replay all fail | `services/authgrant` tests |
| 3 | A passkey signs the transfer's binding digest, so the device signature covers the exact transaction rather than an opaque value | `services/identity-access` ceremony tests |
| 4 | Operators authenticate with a passkey. There is no password anywhere in the operator path | `services/platform-control-bff` tests |
| 5 | Sensitive changes require a second operator. Self-approval is refused by application code **and** by a database constraint | maker-checker tests + `no_self_approval` |
| 6 | The audit trail is append-only and hash-chained. `UPDATE` and `DELETE` raise from a trigger | audit tests + `audit_log_no_update` |
| 7 | A customer cannot decide their own verification tier, and a tier requires verified evidence of the kinds that tier demands | `services/compliance-risk` tests + `no_self_verification` |
| 8 | Limits are enforced by the service before the customer is asked to authorise anything. A refused attempt does not consume the limit | compliance tests |
| 9 | A failed payment rail releases the hold on the customer's funds and does not capture | `services/payments` workflow tests |
| 10 | The kill switch stops payments, and stays stopped if the control plane becomes unreachable | `services/payments/internal/flags` tests |
| 11 | Provider credentials use CSPRNG secrets, HMAC-SHA-256 and constant-time comparison, with real replay protection | `@ephera/connect-layer` tests |
| 12 | Fraud detection is measured on false positives as well as detection, so neither can be improved quietly at the other's expense | `internal/fraud` benchmark |

### Demonstrated end to end, in a real browser

Not simulated — driven through headless Chromium with a CDP virtual
authenticator performing genuine WebAuthn:

- A customer registered a passkey and paid. The account moved from 70000 to
  65000, the recipient from 30000 to 35000, and the evidence recorded method
  `passkey` with a grant reference. The sandbox authenticator was **disabled**
  for that run, so no weaker path was available.
- The same grant replayed under a fresh idempotency key returned **409**. The
  same grant presented for a larger amount returned **401**.
- Two operators worked a maker-checker change: the proposer saw no approve
  button for their own change, the checker approved, and an approved
  `wallet.freeze` genuinely froze the account — a subsequent hold returned
  `account_frozen`.
- An analyst signed in with a passkey and cleared a held payment. The case file
  and the control-plane audit both recorded their identity and their words.

---

## Not claimed

These are stated plainly because a trust document that omits them is worth less
than one that admits them.

- **No real mobile device has completed a passkey payment.** The browser path is
  demonstrated; the mobile app needs an Expo development build and a native
  module. Until then it cannot authorise a payment at all — which is the
  correct failure, but it is a gap.
- **Fraud detection accuracy is unmeasured.** There is no labelled fraud data.
  The scenario benchmark measures agreement with whoever wrote the scenarios.
  It is useful for detecting regressions, not for claiming performance.
- **The screening list is a fixture** of fictional entries matched by exact
  comparison. A real deployment consumes a licensed list with fuzzy matching.
- **Service-to-service authentication is a shared token**, not mutual TLS or
  workload identity.
- **No penetration test, no third-party audit**, no load or resilience testing.
- **Console and provider-portal reads are still seed data** held in memory.
- **No live funds, no production credentials, no real customer data** have ever
  been in this system.
- **There is no AI in the money path.** The intent compiler is 151 lines of
  regular expressions. The platform has no model provider dependency of any
  kind. Where "AI" once appeared as a control surface, it was seed data with
  fabricated telemetry, and that has been removed rather than implemented.

---

## Why the failures are in the repository

Every gate report records what went wrong, including mistakes made while fixing
things:

- A hash chain that could not survive a round-trip through its own storage
  (`G2C-report.md`).
- A kill switch whose guard was never inserted — the build passed, the tests
  passed, and only an end-to-end attempt revealed payments still flowing
  (`f30b5f7`).
- A continuous-integration claim that was overstated, corrected in place rather
  than edited away (`G1-report.md`).
- A fraud benchmark that failed on first run and forced two real modelling
  fixes: a school scored as a money mule, and rent to an established landlord
  flagged for size (`b31d7c8`).

This is deliberate. A platform whose documentation contains no mistakes is
either very young or not telling you everything. The value of the record is that
it shows what happens when something is found — which is the behaviour that
matters once real money is involved.

---

## Where this came from

The platform was audited from a standing start and the findings recorded in a
45-item register with severities and evidence at file-and-line
([`gates/G0-deviation-register.md`](gates/G0-deviation-register.md)). The
original state included an authorisation check that accepted any eight-character
string, a customer wallet that could be driven negative through the public API,
an operator console with no server-side authentication whose password was
printed in its own README, and a provider module presenting a 32-bit unsalted
hash as key derivation.

Those are closed, with the evidence in the gate reports. What remains open is
listed in the register with the same specificity.
