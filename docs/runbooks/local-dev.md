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
| Merchant web (dev) | 3005 |
| Consumer PWA (dev) | 3006 |

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
npm run dev:payments-worker
npm run dev:payments-api
npm run dev:voice-intent
```

Smoke:

```bash
curl -s localhost:8091/health
curl -s localhost:8090/health
curl -s -X POST localhost:8091/v1/compile -H 'content-type: application/json' \
  -d '{"text":"Send 50 cedis to Ama"}'
curl -s -X POST localhost:8090/v1/transfers -H 'content-type: application/json' \
  -d '{"amountMinor":5000,"currency":"GHS","recipientName":"Ama","authorisationRef":"passkey_demo_12345678"}'
```

## Mobile

Use **Expo development builds**, not Expo Go, once native modules land.

```bash
npm run mobile:ios
npm run mobile:android
```

Point the app at APIs with `EXPO_PUBLIC_PAYMENTS_URL` and `EXPO_PUBLIC_VOICE_INTENT_URL` when using a physical device.

## Money safety

Local adapters are simulations only. No live rails, no production keys.
