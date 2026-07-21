# Local development runbook

## Ports

| Service | Port |
| --- | --- |
| Postgres (ledger/identity/ops) | 5433 |
| Redis | 6379 |
| NATS | 4222 |
| NATS monitor | 8222 |
| MinIO API | 9000 |
| MinIO console | 9001 |
| Temporal gRPC | 7233 |
| Temporal UI | 8088 |
| Payments API | **8090** |
| Voice-intent API | **8091** |
| Ledger API | **8092** |
| Merchant web (dev) | 3005 |
| Consumer PWA (dev) | 3006 |
| Super Admin console (dev) | **3007** |
| Provider Portal (dev) | **3008** |

## Start infrastructure

```bash
cd workspace/ephera
cp .env.example .env
npm run infra:up
npm run db:migrate
```

## Verify

```bash
docker compose -f infrastructure/docker-compose.yml ps
npm run test:ledger
npm install
npm run test -w @ephera/validation
```

Temporal UI: http://localhost:8088  
MinIO console: http://localhost:9001 (ephera / ephera_dev_only)

## Gate 1 app services

```bash
# terminals:
npm run db:migrate
npm run dev:ledger            # :8092 authoritative balances
npm run dev:payments-worker
npm run dev:payments-api      # :8090
npm run dev:voice-intent      # :8091
```

Smoke:

```bash
curl -s localhost:8092/v1/accounts/user:demo-self:GHS
curl -s -X POST localhost:8091/v1/compile -H 'content-type: application/json' \
  -d '{"text":"Send 50 cedis to Ama"}'
curl -s -X POST localhost:8090/v1/transfers -H 'content-type: application/json' \
  -d '{"amountMinor":5000,"currency":"GHS","recipientName":"Ama","authorisationRef":"passkey_demo_12345678","idempotencyKey":"demo-1"}'
# balances move in Postgres ledger
curl -s localhost:8092/v1/accounts/user:demo-self:GHS
curl -s localhost:8092/v1/accounts/user:ama:GHS
```

## Mobile & PWA

See **[MOBILE-ACCESS.md](./MOBILE-ACCESS.md)** for:

- Installable **Consumer PWA** (`:3006`) with logo icon on desktop/phone  
- **Expo Go** / **Expo web** on iOS & Android  
- LAN IP setup (never use `localhost` on a real phone)

```bash
npm run dev:consumer-pwa          # PWA :3006 (0.0.0.0)
cd apps/mobile && npx expo start --lan   # full app
```

Point the app at APIs with `EXPO_PUBLIC_PAYMENTS_URL` and `EXPO_PUBLIC_VOICE_INTENT_URL` when using a physical device.

```bash
export LAN_IP=$(ipconfig getifaddr en0)
EXPO_PUBLIC_PAYMENTS_URL=http://$LAN_IP:8090 \
EXPO_PUBLIC_VOICE_INTENT_URL=http://$LAN_IP:8091 \
npx expo start --lan
```

## Money safety

Local adapters are simulations only. No live rails, no production keys.
