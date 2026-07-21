# EPHERA Provider Portal & Connect Layer

| Surface | URL | Role |
| --- | --- | --- |
| **Provider Portal** | http://localhost:3008 | Providers register services, submit compliance, accept country T&Cs, enable open banking / SWIFT |
| **Super Admin** | http://localhost:3007 → **Provider compliance** | Review applications, approve/reject docs, issue API keys, monitor OB/SWIFT opt-in |
| **Package** | `@ephera/connect-layer` | Open banking (Plaid-like), SWIFT/ISO 20022, connector security primitives |

## Why this exists

Providers (merchants, MTN-class MMOs, banks, utilities, TPPs) must not “just go live”. They:

1. Register legal entity + category + countries  
2. See **regulatory criteria** for that country/category (BoG, CBN, CBK, SWIFT CSP, OB security, PCI…)  
3. Submit **licences, T&Cs, AML/KYC, privacy, incident response**, etc.  
4. Accept **platform + country terms**  
5. Optionally enable **open banking** and **SWIFT** layers with security controls  
6. Appear in **Super Admin** until approved (then sandbox API key issued)

## Start

```bash
npm install
npm run dev:provider   # :3008
npm run dev:admin      # :3007 — Provider compliance tab
```

Env:

| Variable | Default |
| --- | --- |
| `PROVIDER_PORTAL_URL` | `http://localhost:3008` (admin → portal) |

## Open banking layer (`@ephera/connect-layer`)

Plaid-style abstraction (sandbox):

- Institution directory (GH/NG/KE + demo EU)  
- Link tokens → item connections → accounts  
- Account name verification  
- Payment initiation (PIS) stub  
- Security policy: OAuth2+PKCE, mTLS, HMAC webhooks, envelope PII  

## SWIFT layer

- BIC directory (sandbox FileAct / planned GPI)  
- Message types: MT103, MT202, pacs.008/009, camt.053, pain.001  
- UETR tracking, signed+encrypted flags, dual control above threshold  

## Security

| Control | Status in sandbox |
| --- | --- |
| API keys on approve | Issued once; fingerprint stored |
| mTLS flag | Declared on application |
| Webhook HMAC verify helper | In connect-layer |
| IP allowlist field | On application security block |
| Super Admin review | Mandatory path to “approved” |

**Not legal advice.** Country annex text is illustrative for product UX.

## API (provider portal)

- `GET/POST/PATCH /api/applications`  
- `POST /api/compliance`  
- `GET /api/catalog`  
- `GET/POST /api/open-banking`  
- `GET/POST /api/swift`  
- `GET/PATCH /api/admin` — Super Admin only  

## Roadmap

- Durable DB + object storage for real PDFs  
- Licensed OB adapters per market  
- Live SWIFT Alliance / gpi  
- Production mTLS + vault + SOC2 evidence packs  
