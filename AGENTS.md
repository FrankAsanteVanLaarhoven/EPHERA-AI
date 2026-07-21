# EPHERA agent rules

## Product

- EPHERA is a **voice-native mobile-money platform**. Ephemeral UI is interaction, not purpose.
- Money moves only after **cryptographic authorisation + policy + independent verification**.
- Voice alone must never authorise high-risk actions.

## Stack (do not quietly change)

- Mobile: React Native + Expo **development builds** + Swift/Kotlin modules + Rust helpers
- Web: Next.js
- Backend: AWS · Aurora PostgreSQL · Temporal · ECS Fargate
- Firebase: FCM/Crashlytics only
- Supabase: optional prototype only — never ledger

## Engineering

- Minor units for money (integers). No floats for balances.
- Double-entry ledger only. No direct balance updates from apps.
- Closed component library for money UI (no freeform generative financial screens).
- Prefer shared schemas over shared visual components across mobile/web.
- No live funds in local or CI.

## When implementing

1. Read `docs/product/THESIS.md`
2. Keep trust boundary intact
3. Add tests for money paths
4. Update runbooks if ports/services change
