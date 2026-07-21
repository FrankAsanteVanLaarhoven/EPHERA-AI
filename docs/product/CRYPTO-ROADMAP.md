# Crypto coins · send · trade (eToro-style) — planned

**Status:** Not implemented in the current sandbox. Fiat mobile-money rails only.

## Intent

Extend EPHERA Money so users can:

1. Hold **crypto assets** alongside GHS/NGN/KES wallets  
2. **Send** crypto to contacts or addresses  
3. **Buy / sell / trade** with transparent fees (eToro-like simplicity)  
4. Use the same voice + passkey + trust markers model where appropriate  

## Principles (non-negotiable)

- Clear **custody / non-custody** model and disclosures  
- Only launch where **licensed**  
- Full cost, spread, and risk shown before any trade  
- No “Money without limits” language on crypto product legal copy  
- Same brand system (three bars, tube, haptics) for asset states  

## Suggested product surfaces

| Surface | Role |
|--------|------|
| **Assets** tab | Fiat + crypto balances |
| **Trade** | Simple buy/sell with quote lock |
| **Send crypto** | Address / contact / QR |
| **EPHERA Connect** | Partner exchange / liquidity |

## Engineering sketch (later)

- New ledger accounts / asset codes (not mixed with fiat double-entry without policy)  
- Adapter service to exchange APIs  
- Price feed + quote service  
- Risk / AML policy for on/off ramp  
- PWA + native parity for watchlist and simple trade  

PWA already shows an **Assets** placeholder so product messaging is consistent before build.
