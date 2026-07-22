# ADR 0004 — Voice proposes; it never authorises

**Status:** Accepted (not yet implemented)
**Date:** 2026-07-21
**Gate:** G0 decision; G2 implementation

## Context

The product thesis is that a user states what they need and the platform
compiles it into a precise financial instrument. That is only safe if the
compilation step can propose and nothing more. A recorded voice, a synthesised
voice, or a prompt-injected model output must all be incapable of moving money.

The intent service is well built for this: it is rule-based, it returns
`canAuthoriseFromVoiceAlone: false` unconditionally, and it classifies risk and
clarification need. The shared validation package encodes the rule as a function
that can only return `false`.

The enforcement is weaker than it looks. The screen that actually runs in the
mobile app performs no check on the compiled intent at all — the guard that
inspects `canAuthoriseFromVoiceAlone` lives in a screen that is never mounted.
The live screen fires a hardcoded utterance at an endpoint that does not exist,
swallows the 404, and falls through to a hardcoded intent with a fabricated
confidence and a recipient marked verified. The rule survives today only because
the voice path cannot reach the transfer call directly — an accident of
navigation, not a control.

## Decision

The boundary is enforced server-side and asserted client-side.

1. **Structural.** The intent service returns proposals. It has no credential
   for, and no route to, the ledger or the payment orchestrator.
2. **Asserted.** Any client consuming a compiled intent rejects the response if
   `canAuthoriseFromVoiceAlone` is anything but `false`, and refuses to build an
   authorise panel when `needsClarification` is true or confidence is below the
   validation threshold. This assertion lives on the path that ships, not in a
   parallel unused file.
3. **Re-derived, not trusted.** Amount, recipient and fee shown on the
   confirmation panel are re-derived from a server quote before authorisation.
   A recipient is never marked verified on the strength of a voice utterance or
   a scanned payload.
4. **Separately authorised.** The user's authorisation (ADR 0002) is over the
   confirmed instrument, not over the utterance. The utterance is evidence of
   intent; the assertion is evidence of consent.
5. **The rule is code, not copy.** Strings such as "voice proposes, passkey
   authorises" may only appear on screens where the corresponding check exists.

## Consequences

- The unmounted route tree must be either wired up or deleted; keeping the
  stricter logic in dead files while shipping the weaker path is the specific
  failure this ADR exists to prevent.
- The client must call the endpoint the service actually exposes, and must
  surface failures instead of degrading to a hardcoded intent.
- Scanned QR payloads are untrusted input and follow the same re-derivation
  rule as voice.

## Evidence at time of writing

- Correct: `services/voice-intent/main.py:47-52`,
  `packages/validation/src/index.ts` (`canAuthoriseFromVoiceAlone`).
- Deviation D-36: `apps/mobile/screens/ListeningScreen.tsx` performs no check;
  the guard exists only in the unmounted `apps/mobile/screens/VoiceScreen.tsx:30-32`.
- Deviation D-41: `apps/mobile/lib/api.ts:112` posts to `/v1/parse`; the service
  exposes `/v1/compile`. The 404 is swallowed and a hardcoded intent is used.
- Deviation D-42: `apps/mobile/index.js` mounts `App`, leaving the router tree
  and roughly eight screens unreachable.
- `apps/mobile/screens/ScanQrScreen.tsx:54-62` marks a scanned recipient
  verified with confidence 0.99.
