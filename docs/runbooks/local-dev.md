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
| identity-access | **8093** |
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
npm install
npm run test -w @ephera/validation
npm run test:financial-core   # specification crate, not the ledger service
```

### Migrations

`npm run db:migrate` applies each file in `services/ledger/migrations` exactly
once and records it in `schema_migrations` with a checksum. Re-running is a
no-op. Editing an already-applied migration fails the run — add a new file
instead.

Where the `docker` on PATH is a wrapper without compose support, pass the real
binary: `DOCKER=/usr/bin/docker npm run db:migrate`.

### Ledger tests

Unit tests run anywhere. The schema-invariant tests need a migrated database
and skip without one:

```bash
npm run db:migrate
cd services/ledger
LEDGER_TEST_DATABASE_URL='postgres://ephera:ephera_dev_only@localhost:5433/ephera_ledger?sslmode=disable' \
  go test ./...
```

Temporal UI: http://localhost:8088  
MinIO console: http://localhost:9001 (ephera / ephera_dev_only)

## Gate 1 app services

```bash
# terminals:
npm run db:migrate
npm run db:migrate:identity
npm run dev:ledger            # :8092 authoritative balances
npm run dev:payments-worker
npm run dev:payments-api      # :8090
npm run dev:identity          # :8093 mints authorisation grants
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

## Sending money in the sandbox

Money movement takes three steps, and the ledger enforces the order (ADR 0002):

1. `POST :8090/v1/transfers/prepare` — fixes the transfer id, recipient account
   and fee. Nothing is reserved.
2. `POST :8093/v1/grants` — mints an authorisation grant bound to exactly those
   values. Only identity-access holds the signing key.
3. `POST :8090/v1/transfers` — submits the prepared transfer with the grant.

The ledger verifies the signature, the validity window and the binding, and
consumes the grant so it cannot be used twice. Start the ledger with
`LEDGER_AUTH_PUBLIC_KEY` set to the key printed by identity-access at startup
(or read it from `GET :8093/v1/keys`); without it the ledger refuses every
transfer rather than falling back to accepting an unverified string.

### Authorising with a passkey

The real path is WebAuthn:

1. `POST :8093/v1/passkeys/register/begin` and `/finish` — register a credential
   once per device.
2. `POST :8093/v1/grants/challenge` — the challenge returned **is** the transfer's
   binding digest, so the authenticator signs the transaction itself.
3. `POST :8093/v1/grants/passkey` — a verified assertion mints a grant with
   method `passkey`.

In the consumer surface this is wired: "Register passkey" runs the registration
ceremony, and "Authorise with passkey & send" signs the prepared transfer. The
relying-party id and origins must match where the app is served —
`IDENTITY_RP_ID` and `IDENTITY_RP_ORIGINS`. WebAuthn requires a secure context,
so use `localhost` or https.

### The sandbox authenticator

`POST :8093/v1/grants` mints a grant with **no authenticator challenge at all**.
It exists so the local demo runs without registering a credential. It is off
unless `IDENTITY_ALLOW_SANDBOX_AUTHENTICATOR=true`, refuses to run outside a
sandbox environment, and is refused outright for any subject that has registered
a passkey — a weaker method is never reachable for a user who has a stronger one.

Grants minted this way are labelled `sandbox_authenticator` in the grant, in the
ledger's grant table and in authorisation evidence. That label is the honest
statement of what they prove: the transaction was bound and not replayed, not
that a human approved it.
