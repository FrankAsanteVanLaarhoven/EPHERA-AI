# EPHERA brand system

> Discipline over spectacle. The three bars are EPHERA’s universal language: **static when inactive, responsive when listening, locked when securing money, aligned when the transaction is complete.**

---

## 1. Logo modes

| Mode | File | Use |
|------|------|-----|
| Illuminated | `packages/brand/svg/symbol-illuminated.svg` | Splash, launch film, premium marketing only. Min **48px**. |
| Flat white | `symbol-flat-white.svg` | Product UI on dark surfaces. Min **16px**. |
| Flat dark | `symbol-flat-dark.svg` | Product UI on light surfaces. Min **16px**. |
| Monochrome | `symbol-mono.svg` | Single-colour / `currentColor`. Emboss, fax, legal mono. |
| High contrast | `symbol-high-contrast.svg` | Accessibility / forced-colors. |

**Operational logo = flat.** Illuminated is never required for core product flows.

## 2. Vector masters

Location: `packages/brand/svg/`

| Asset | Purpose |
|-------|---------|
| `symbol-*.svg` | Symbol only (4 modes + a11y) |
| `lockup-horizontal-white.svg` | Symbol + custom E + PHERA |
| `lockup-stacked-white.svg` | Symbol / EPHERA / campaign line |
| `lockup-institutional.svg` | Flat navy/white + corporate descriptor |
| `wordmark-only-white.svg` | Wordmark only |
| `monogram.svg` | Compact E for cards / tiny surfaces |
| `app-icon.svg` | Launcher icon master |
| `merchant-accepted.svg` | “EPHERA Accepted Here” |
| `verified-badge.svg` | “Verified by EPHERA” |

**Export checklist (design ops):** EPS · PDF vector · transparent PNG · WebP · Figma component · Lottie/Rive — from the same clean paths, **not** image traces of AI renders.

### Authoritative geometry (viewBox 96×96)

```
bar height  14
gap         7   (equal optical spacing)
radius      7   (full capsule ends)
top/bottom  x=16  width=64
middle      x=16  width=48  (E silhouette)
clear space 0.25 × symbol height
min size    16px flat · 48px illuminated
```

## 3. Living symbol states

| State | Motion | UI label |
|-------|--------|----------|
| Idle | Calm, aligned bars | — |
| Voice activated | Bars separate slightly | Voice activated |
| Listening | Independent waveform motion | Listening |
| Processing | Compress / pulse to centre | Processing |
| Confirmation | Align + brief light | Confirmed |
| Payment completed | Soft line through bars → rest | Done |
| Security warning | Lock into shield-like stack | Security |

Implementation: `apps/mobile/components/brand/EpheraBars.tsx`  
Lottie seed: `packages/brand/lottie/bars-listening.json`

## 4. Sonic identity (three-note system)

Maps to the three bars:

| Note | Meaning |
|------|---------|
| 1 | Intent received |
| 2 | Identity verified |
| 3 | Action completed |

Variants: listening · success · warning · fail · incoming · secure authorisation.  
Specs: short (≤400ms per cue), calm, non-irritating.  
Motif: C5–E5–G5 (calm mid register).  
Hooks: `apps/mobile/lib/brand-system/sonic.ts` (Web Audio demo; production WAV/CAF later).

## 5. Haptic identity

| Event | Pattern |
|-------|---------|
| Voice activated | One soft pulse |
| Intent understood | Two short pulses |
| Authorisation required | One firm pulse |
| Payment completed | Three ascending pulses |
| Security warning | Two firm separated pulses |
| Incoming payment | Soft double pulse |

Implementation: `apps/mobile/lib/brand-system/haptics.ts` (expo-haptics when available).

## 6. Wordmark & dual messaging

```
EPHERA
Money without limits                    ← campaign only (consumer ads / splash)
The voice-native financial network      ← institutional (banks, regulators, APIs)
Speak. Send. Done.                      ← product UI short line
```

**Campaign line** is memorable but can imply “no compliance limits” — keep for consumer marketing only.  
**Corporate descriptor** is the defensible institutional statement.

Custom **E** in the wordmark mirrors the three-bar symbol. Prefer light weight + open tracking over exaggerated sci-fi faces for bank/government credibility.

## 7. Brand architecture

| Product | Role |
|---------|------|
| **EPHERA Money** | Consumer finance |
| **EPHERA Business** | Merchants and small businesses |
| **EPHERA Connect** | Banks, telecoms and partners |
| **EPHERA Voice** | Voice interaction |
| **EPHERA Identity** | Credentials and verification |
| **EPHERA Guard** | Security and fraud |
| **EPHERA Agents** | Physical cash and liquidity network |
| **EPHERA Foundation** | Inclusion and social-impact programmes |

Same symbol; controlled secondary labels only.

## 8. Trust markers (UI)

Beauty never replaces disclosure. Surface when relevant:

* Verified recipient · Regulated provider · Protected balance  
* Secure device / passkey · Fee fully disclosed · Rate locked  
* Rail selected · Recipient confirmation · Reversible vs irreversible  
* Settlement completed  

Component: `TrustMarker` / `TrustRow` — wired on Send review and Receipt.

## 9. Colour roles (controlled tokens)

| Role | Hex | Usage |
|------|-----|--------|
| Midnight navy | `#050B18` | Main background |
| Deep graphite | `#0C1526` | Panels / navigation |
| Ice white | `#F4F8FF` | Primary typography |
| Electric blue | `#3B82F6` | Voice, active, identity **only** |
| Cyan | `#22D3EE` | Connectivity / information |
| Emerald | `#34D399` | Settled, received, verified |
| Amber | `#FBBF24` | Attention / pending |
| Crimson | `#F87171` | Fraud, blocked, destructive |

Do **not** use electric glow for every CTA. When everything glows, nothing communicates priority.

Source: `packages/brand/src/tokens.ts` (mirrored for Metro in `apps/mobile/lib/brand-system/tokens.ts`).

## 10. Accessibility

* High-contrast mark (`symbol-high-contrast.svg`)  
* Reduced-glow / no-glow (flat modes)  
* `prefers-reduced-motion` → static bars in `EpheraBars`  
* Screen-reader labels on animated mark  
* Haptic + sonic equivalents  
* Clear space ≥ 0.25× symbol height  
* Min symbol 16px (48px if glow)  
* App usable with blur / animation / transparency off, high contrast, no sight, no hearing  

Privacy states must remain textual, not colour-only.

## 11. Logo family

1. Primary stacked  
2. Horizontal  
3. Symbol only  
4. Wordmark only  
5. Monogram (compact E)  
6. Voice-state animated (`EpheraBars`)  
7. Merchant: “EPHERA Accepted Here”  
8. Verified: “Verified by EPHERA”  
9. Institutional (flat + descriptor)  

## 12. Privacy states (Voice)

| State | Visual |
|-------|--------|
| Not listening | Static bars |
| Listening locally | Soft blue motion + badge |
| Cloud processing | Ring + explicit **Cloud processing** label |
| Recording with consent | Amber/red indicator |
| Mic disabled | Dim bars + strike |
| Voice history off | Private-mode badge |

Component: `VoicePrivacySignal` — user must never be uncertain whether the app is listening.

## 13. App icon

* Three bars only · midnight navy base · minimal wash  
* No text · no planet · no thin details  
* Targets: 16 favicon · 24 notification · 48 Android · 60 iOS · watch · emboss · QR sticker  

Master: `app-icon.svg`

## 14. Institutional version

Flat navy and white · no glow · no space imagery · corporate descriptor.  
Suitable for legal documents, APIs, bank dashboards, regulator packs.

## 15. Surfaces to test

Physical debit · virtual card · merchant QR plaque · POS · smartwatch · ATM · USSD · receipt · invoice · SIM toolkit · agent uniform · branch signage.

Illuminated = premium cards / launch; flat = emboss / print.

## 16. Protection checklist

* [ ] Trademark clearance (word + device)  
* [ ] Classes: financial services + software  
* [ ] Domains / socials  
* [ ] Separate registration of symbol and wordmark  
* [ ] Provenance record for masters (this repo + date)  
* [ ] Brand-usage policy; no public editable masters pre-filing  

## 17. Highest-priority deliverables status

| # | Item | Status |
|---|------|--------|
| 1 | Precisely redrawn vector symbol | ✅ Clean rect masters in `packages/brand/svg/` |
| 2 | Final custom wordmark | ✅ Horizontal + stacked + wordmark-only + custom E |
| 3 | Symbol-only app icon | ✅ `app-icon.svg` |
| 4 | Dark / light / mono | ✅ + high-contrast |
| 5 | Animated voice-state logo | ✅ `EpheraBars` + Lottie seed; wired into orb / listening |
| 6 | Three-note sonic signature | ✅ Spec + Web Audio hook |
| 7 | Haptic signature | ✅ Spec + hook; wired voice + payment |
| 8 | Colour / type tokens | ✅ `@ephera/brand` + mobile mirror |
| 9 | Clear-space / min-size guide | ✅ This doc + geometry block |
| 10 | Merchant / bank / card mocks | ✅ SVG mocks: `mock-card-front.svg`, `mock-merchant-plaque.svg` |
| 11 | Accessibility variants | ✅ HC SVG + reduced-motion + privacy labels |
| 12 | Trademark / domain review | ⏳ Legal (external) |

## 18. Runtime wiring (product)

| Surface | Behaviour |
|---------|-----------|
| Floating voice orb | Idle bars; haptic + sonic on open |
| Listening screen | Live bars + `VoicePrivacySignal` (local / cloud) |
| Send review | Trust markers before authorise |
| Payment success | Three haptic pulses + success sonic |
| Receipt | Settlement + trust row |

---

*Provenance: masters introduced in monorepo brand package. Prefer vector rebuilds over any AI splash PNG for trademark filing.*
