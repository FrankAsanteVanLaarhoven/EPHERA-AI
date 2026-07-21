# Threat model (Gate 0 sketch)

Full model to expand in Gate 1. Priority threats:

| Threat | Mitigation direction |
| --- | --- |
| Deepfake / recorded voice authorisation | Voice never sufficient for high-risk; passkey required |
| Wrong recipient | Verify display, account hint, confirmation read-back |
| SIM swap | Device binding, step-up, SIM risk signals (native module) |
| Replay / double spend | Idempotency keys, Temporal workflows |
| Offline reconcile failure | Pending until revalidated; partner status authoritative |
| Ambient audio exfil | Local wake-word; no continuous cloud mic while idle |
| Ledger tampering via app | Server ledger SoR; mobile offline helpers only |
| Prompt injection into money path | Typed PaymentIntent + closed panel library |

## Trust boundary

Speech/LLM proposes → policy validates → user authenticates → kernel posts → evidence proves.
