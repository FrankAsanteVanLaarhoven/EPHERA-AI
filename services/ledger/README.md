# Ledger service

Authoritative **double-entry** money truth on PostgreSQL.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | |
| GET | `/v1/accounts/{externalRef}` | Balance + status |
| POST | `/v1/holds` | Place hold (idempotent) |
| POST | `/v1/holds/{id}/release` | Release open hold |
| POST | `/v1/transfers` | Capture hold + post journal (**auth required**) |
| POST | `/v1/accounts/{ref}/freeze` | Freeze wallet (**auth required**) |
| POST | `/v1/accounts/{ref}/unfreeze` | Unfreeze (**auth required**) |

## Sandbox accounts

| external_ref | Opening |
| --- | --- |
| `user:demo-self:GHS` | 1,000.00 GHS |
| `user:ama:GHS` | 0 |
| `system:clearing:GHS` / `system:fee:GHS` | system |

## Local

```bash
npm run db:migrate
npm run dev:ledger
```

Port **8092**. Never expose without API gateway auth in production.
