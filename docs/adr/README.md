# Architecture decision records

Each ADR records one decision, the context that forced it, and what it costs us.
An ADR is not a design document and not a roadmap item — if it does not constrain
future code, it does not belong here.

## Status values

| Status | Meaning |
| --- | --- |
| `Accepted` | Binding now. Code that contradicts it is a defect. |
| `Accepted (not yet implemented)` | Binding as a target. Current code deviates; the deviation is tracked in the register. |
| `Superseded` | Replaced by a later ADR, which must be named. |

`Accepted (not yet implemented)` is used deliberately. At Gate 0 several of the
platform's core rules are stated in `AGENTS.md` and `docs/product/THESIS.md` but
are not enforced anywhere in the code. Recording them as accepted-but-unbuilt is
what makes the gap auditable instead of invisible.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-ledger-is-sole-balance-authority.md) | The ledger is the sole authority for balances | Accepted |
| [0002](0002-authorisation-is-a-verifiable-credential.md) | Authorisation is a verifiable credential, not a string | Accepted (not yet implemented) |
| [0003](0003-service-topology.md) | Eight deployables, not a microservice estate | Accepted |
| [0004](0004-voice-proposes-never-authorises.md) | Voice proposes; it never authorises | Accepted (not yet implemented) |
| [0005](0005-money-is-integer-minor-units.md) | Money is integer minor units end to end | Accepted |
| [0006](0006-transfer-state-machine.md) | One persisted transfer state machine | Accepted (not yet implemented) |
| [0007](0007-evidence-is-append-only.md) | Evidence and audit are append-only and external to app state | Accepted (not yet implemented) |
| [0008](0008-no-in-memory-regulated-state.md) | No in-memory state for regulated records | Accepted (not yet implemented) |
| [0009](0009-simulated-surfaces-must-be-labelled.md) | Simulated data must be distinguishable from attested data | Accepted (not yet implemented) |

## Related

- Current-state baseline: [`../gates/G0-baseline.md`](../gates/G0-baseline.md)
- Deviation register: [`../gates/G0-deviation-register.md`](../gates/G0-deviation-register.md)
- Trust boundaries: [`../architecture/trust-boundaries.md`](../architecture/trust-boundaries.md)
