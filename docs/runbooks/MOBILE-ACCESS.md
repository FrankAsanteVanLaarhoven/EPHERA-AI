# Access EPHERA on browser, desktop PWA, and phones

## URLs (local development)

Replace `LAN_IP` with your machine’s Wi‑Fi address (example: `10.182.131.112`).

| Surface | URL | Port |
|--------|-----|------|
| **Consumer PWA** (installable web app) | `http://LAN_IP:3006` | 3006 |
| **Expo mobile web** (full RN shell in browser) | `http://LAN_IP:8081` | 8081 |
| **Expo DevTools** | `http://localhost:8081` | 8081 |
| Payments API | `http://LAN_IP:8090` | 8090 |
| Voice intent | `http://LAN_IP:8091` | 8091 |
| Ledger | `http://LAN_IP:8092` | 8092 |

Find LAN IP (macOS):

```bash
ipconfig getifaddr en0
```

---

## 1. Desktop PWA (install logo icon)

```bash
cd workspace/ephera
# APIs already running recommended
npm run dev:consumer-pwa
# → http://localhost:3006  and  http://LAN_IP:3006
```

### Chrome / Edge (Windows, macOS, Linux, ChromeOS)

1. Open `http://localhost:3006` (or LAN URL).
2. Click the **install** icon in the address bar, **or** menu → **Install EPHERA Money**.
3. Or use the in-app **Install** banner / **Install** tab.
4. App opens standalone with the **EPHERA logo** as the desktop/dock icon.

### Safari (macOS)

1. Open the PWA URL.
2. **File → Add to Dock** (or Share → Add to Dock where available).

Icons served from `/icons/icon-192.png`, `/icons/icon-512.png`, maskable icon, and `manifest.webmanifest`.

---

## 2. Phone — install PWA (no App Store)

Phone and computer must be on the **same Wi‑Fi**. Mac firewall must allow incoming on 3006 / 8081.

### Android (Chrome)

1. On the phone open `http://LAN_IP:3006`.
2. Menu → **Install app** / **Add to Home screen**.
3. Launch from home screen (standalone, logo icon).

### iPhone / iPad (Safari only for Add to Home Screen)

1. Open `http://LAN_IP:3006` in **Safari** (not Chrome).
2. **Share** → **Add to Home Screen**.
3. Confirm name **EPHERA** and the logo.
4. Open from home screen.

---

## 3. Full mobile app via Expo (iOS / Android)

Full product: voice orb, QR camera, tabs, security, etc.

### Option A — Expo Go (fastest trial)

1. Install **Expo Go** from App Store / Play Store.
2. On the computer:

```bash
cd workspace/ephera/apps/mobile
EXPO_PUBLIC_PAYMENTS_URL=http://LAN_IP:8090 \
EXPO_PUBLIC_VOICE_INTENT_URL=http://LAN_IP:8091 \
npx expo start --lan
```

3. Scan the QR code with:
   - **iOS:** Camera app → opens Expo Go  
   - **Android:** Expo Go → Scan QR  
4. Wait for Metro bundle; app loads.

### Option B — Expo web (same codebase in mobile browser)

```bash
cd workspace/ephera/apps/mobile
EXPO_PUBLIC_PAYMENTS_URL=http://LAN_IP:8090 \
EXPO_PUBLIC_VOICE_INTENT_URL=http://LAN_IP:8091 \
npx expo start --web --lan
```

Open `http://LAN_IP:8081` on the phone browser.

### Option C — Development build (passkeys / production native)

```bash
npx expo run:ios
# or
npx expo run:android
```

Required for real platform passkeys and production push later.

---

## 4. Point the app at your APIs on a physical device

Do **not** use `localhost` on a real phone (that is the phone itself).

```bash
export LAN_IP=$(ipconfig getifaddr en0)
export EXPO_PUBLIC_PAYMENTS_URL=http://$LAN_IP:8090
export EXPO_PUBLIC_VOICE_INTENT_URL=http://$LAN_IP:8091
```

For the PWA:

```bash
cd apps/consumer-pwa
NEXT_PUBLIC_PAYMENTS_URL=http://$LAN_IP:8090 npm run dev
```

---

## 5. Suggested all-in-one start

```bash
# infra + APIs (separate terminals as needed)
npm run infra:up
npm run dev:ledger
npm run dev:payments-api
npm run dev:voice-intent

# PWA (browser + install)
npm run dev:consumer-pwa

# Full mobile shell
cd apps/mobile && npx expo start --lan
```

---

## 6. Roadmap note — crypto (eToro-style)

**Not in this release.** Planned:

- Multi-asset wallets (fiat + crypto coins)
- Send crypto to addresses / contacts
- Buy / sell / trade with disclosed fees (eToro-like UX)
- Only where regulated; clear risk and custody model

PWA **Assets** tab already reserves UI for this path.

---

## Troubleshooting

| Issue | Fix |
|------|-----|
| Phone cannot open URL | Same Wi‑Fi; use LAN IP not localhost; check macOS Firewall |
| Install not offered | Chrome needs HTTPS **or** localhost; on LAN use “Add to Home Screen” / menu Install |
| Balance offline | Start payments `:8090` and ledger `:8092` |
| Expo QR fails | `npx expo start --lan --clear`; same subnet |
| CORS on PWA | Payments API already allows CORS; confirm API is up |

---

## Download logo assets (manual)

Brand icons for external use:

- `apps/mobile/assets/brand/official-symbol-neon.png`
- `apps/mobile/assets/brand/app-icon.png`
- `apps/consumer-pwa/public/icons/*`

PWA install also places the icon on the device automatically when installed.
