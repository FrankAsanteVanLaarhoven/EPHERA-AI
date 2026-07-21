# Payments service (Go + Temporal)

## Components

| Binary | Port | Role |
| --- | --- | --- |
| `cmd/worker` | — | Temporal worker on queue `ephera-payments` |
| `cmd/api` | 8090 | HTTP quotes + transfer start |

Workflows:

- `DomesticTransferSim` — quote → auth → hold → rail execute → capture → receipt
- `AirtimePurchaseSim` — airtime sandbox purchase

Adapters (in-process sims):

- `mobile-money-sim`
- `bank-transfer-sim`
- `airtime-sim`

## Rules

- Every stage is idempotent
- **AuthorisationRef required** — voice alone is never enough
- No live provider credentials in this repo

## Local

```bash
npm run infra:up
npm run dev:payments-worker
npm run dev:payments-api
# Temporal UI: http://localhost:8088
go test ./...
```
