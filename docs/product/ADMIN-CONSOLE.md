# EPHERA Super Admin Console

**App:** `apps/admin-console`  
**URL (local):** http://localhost:3007  
**Audience:** Platform operators only — not end users.

## Purpose

Remote control plane for the entire EPHERA Money platform:

| Module | Capability |
| --- | --- |
| **Command centre** | Live service health, demo wallet, KPIs, kill switches, AI-backed recommendations |
| **Workflows & errors** | Temporal-shaped activity failures (e.g. `PostLedgerHold` / `insufficient_funds`) |
| **Analytics** | Devices (iOS/Android/PWA/web), regions, currency volumes, hourly intensity |
| **Feature control** | Remote feature flags + % rollout for voice, PWA, freeze, crypto, video verify, etc. |
| **Providers & rails** | MTN, banks, open banking, utilities, cards — status control |
| **Users & devices** | KYC, freeze/suspend, device string; demo freeze hits payments API |
| **Transactions** | Linked to workflow IDs and fail reasons |
| **Mandates** | Direct debit, standing orders, recurring, subscription billing |
| **Communications** | Push, SMS, WhatsApp, voice/video call records (future telephony) |
| **AI models** | Enable/canary/disable engines; client AI subscription quotas |
| **Audit log** | Super-admin actions |

## Sandbox login

Password (local only):

```text
ephera-super-admin
```

Replace with SSO + passkeys + IP allowlists before any shared environment.

## Start

```bash
# from monorepo root
npm install
npm run dev:admin
# → http://localhost:3007  (0.0.0.0 for LAN)
```

Optional env:

| Variable | Default |
| --- | --- |
| `PAYMENTS_URL` | `http://localhost:8090` |
| `LEDGER_URL` | `http://localhost:8092` |
| `VOICE_INTENT_URL` | `http://localhost:8091` |
| `TEMPORAL_UI_URL` | `http://localhost:8088` |

## Why you see `insufficient_funds`

Sandbox demo wallet `user:demo-self:GHS` often has **available &lt; ₵50**.  
PWA / voice transfers of ₵50 start `DomesticTransferSim` → `PostLedgerHold` → ledger `409 insufficient_funds`.

The Super Admin **Command centre** and **Workflows** views surface these exact workflow IDs (e.g. `transfer-pwa_1784617797470`) and recommend funding the demo wallet or lowering the transfer amount.

## API surface (BFF)

All under `/api/*` on the admin app:

- `GET /api/overview` · `GET /api/workflows` · `GET /api/analytics`
- `GET|PATCH /api/features` · `GET|PATCH /api/providers` · `GET|PATCH /api/users`
- `GET /api/transactions` · `GET|PATCH /api/mandates` · `GET /api/communications`
- `GET|PATCH /api/ai` · `GET|POST /api/actions` · `GET /api/health`

## Roadmap (same console)

1. Stream Temporal history via Temporal API (not only seeded + ingested events)
2. Real WebRTC / CPaaS for bank-style voice & video authorisation
3. Durable feature-flag service consumed by mobile + PWA
4. Multi-tenant RBAC (ops, risk, support, finance)
5. AI subscription billing ledger integration

## Security notes

- Console is **not** a customer product.
- In-memory control store resets on process restart (sandbox).
- Never commit production admin secrets.
