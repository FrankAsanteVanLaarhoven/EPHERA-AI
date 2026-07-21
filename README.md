# EPHERA Money

[![CI](https://github.com/FrankAsanteVanLaarhoven/EPHERA-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/FrankAsanteVanLaarhoven/EPHERA-AI/actions/workflows/ci.yml)

**Repository:** [github.com/FrankAsanteVanLaarhoven/EPHERA-AI](https://github.com/FrankAsanteVanLaarhoven/EPHERA-AI)

**Voice-native mobile money, banking and commerce infrastructure for Africa and underserved markets.**

> People should not have to understand banking applications, payment rails or menu structures. They should state what they need, see the exact cost and consequence, approve it securely, and receive proof that it happened.

Ephemeral UI is how users interact with EPHERA; it is not the product’s primary purpose.

## Product surfaces

| Product | Users | Role |
| --- | --- | --- |
| **EPHERA Money** | Individuals & families | Wallet, transfers, bills, savings, international payments |
| **EPHERA Business** | Merchants & SMEs | Checkout, QR, invoices, settlement |
| **EPHERA Connect** | Banks, telcos, providers | APIs, settlement, embedded finance |
| **EPHERA Voice** | All users | Multilingual voice operating layer |

## Stack (locked)

- **Mobile:** React Native + Expo **development builds** (not Expo Go) + Swift/Kotlin modules + Rust device helpers
- **Web:** Next.js PWA / merchant / partner portals
- **Backend:** AWS · Aurora PostgreSQL · ECS Fargate · Temporal · Redis/Valkey · NATS
- **Ledger:** Append-only double-entry on PostgreSQL (authoritative money truth)
- **Firebase:** push (FCM) + crash reporting only
- **Supabase:** optional prototype only — never the ledger

**Trust rule:** Voice proposes. Policy validates. User authorises with passkey. Kernel posts. Evidence proves. The model never releases funds.

## Repository map

```text
apps/           mobile (Expo), merchant-web, consumer-pwa, partner-portal, admin-console
packages/       shared TypeScript schemas, validation, SDKs, tokens
native/         Swift, Kotlin, Rust financial-core (device-side helpers)
services/       ledger, payments, identity, policy, voice-intent, adapters
infrastructure/ docker-compose, terraform
docs/           product, intents, threat model, runbooks
```

## Quick start (local)

**Prerequisites:** Docker Desktop, Node 20+, Rust stable, Go 1.22+ (payments later), pnpm or npm.

```bash
cd workspace/ephera

# Infrastructure
docker compose -f infrastructure/docker-compose.yml up -d

# JS workspace
npm install

# Ledger unit tests (no Docker required for pure engine tests)
cd native/financial-core && cargo test && cd ../..

# Apply ledger SQL (when Postgres is up)
./scripts/db-migrate.sh

# Gate 1 services (separate terminals)
npm run db:migrate
npm run dev:ledger            # :8092 Postgres double-entry
npm run dev:payments-worker   # Temporal
npm run dev:payments-api      # :8090
npm run dev:voice-intent      # :8091

# Merchant web
npm run dev:merchant

# Mobile (development build — not Expo Go for security modules)
npm run mobile:ios     # requires Xcode
npm run mobile:android # requires Android Studio
```

Default local ports are listed in [`docs/runbooks/local-dev.md`](docs/runbooks/local-dev.md).

### Sandbox transfer smoke test

```bash
curl -s -X POST localhost:8091/v1/compile -H 'content-type: application/json' \
  -d '{"text":"Send 50 cedis to Ama"}'

curl -s -X POST localhost:8090/v1/transfers -H 'content-type: application/json' \
  -d '{"amountMinor":5000,"currency":"GHS","recipientName":"Ama","authorisationRef":"passkey_demo_12345678"}'
```

Without `authorisationRef`, the API returns `401 authorisation_required`.

## Phase status

| Gate | Scope | Status |
| --- | --- | --- |
| **0** | Monorepo, compose, ledger schema/engine, schemas, stubs | Done |
| **1** | Payments + Temporal + Postgres ledger + freeze + voice + mobile | Done (sandbox) |
| **2** | Checkout SDK, merchant acceptance | Planned |
| **3** | One real domestic corridor | Planned |

## Safety

No live funds in local or CI. Simulated adapters only until Gate 3.

## License

Proprietary — all rights reserved until otherwise stated.
