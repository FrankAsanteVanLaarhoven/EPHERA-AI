"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchBalance,
  formatGhs,
  prepareTransfer,
  sendTransfer,
  PAYMENTS,
  type Balance,
} from "../lib/api";
import { passkeysSupported, registerPasskey } from "../lib/webauthn";

const DEMO_SUBJECT = "user:demo-self:GHS";

function installHelp(env: InstallEnv): string {
  switch (env) {
    case "installed":
      return "EPHERA is already installed on this device. Open it from your home screen or app list.";
    case "ios":
      return "On iPhone and iPad, Safari installs apps from the share sheet: tap Share, then “Add to Home Screen”. There is no button a website can offer for this.";
    case "insecure":
      return "This page is not on a secure origin, so the browser will not install it. Open it on http://localhost:3006, or serve it over https — a LAN address like http://192.168.x.x will never be installable.";
    case "prompt":
      return "Ready to install.";
    default:
      return "Your browser has not offered an install prompt. In Chrome or Edge use the menu → “Install EPHERA” (or the install icon in the address bar). Firefox does not support installing web apps on desktop.";
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * How this browser can install the app.
 *
 * Everything used to hang off `beforeinstallprompt`, which fires only in
 * Chromium, only over a secure context, and only when the app is not already
 * installed. Everywhere else the user was shown nothing to click at all. The
 * install path now always resolves to something actionable.
 */
type InstallEnv =
  | "checking"
  | "installed" // already running as an installed app
  | "prompt" // Chromium fired beforeinstallprompt: one click installs
  | "ios" // iOS/iPadOS Safari: share sheet only, no programmatic install
  | "insecure" // http on a LAN address: no service worker, cannot install
  | "manual"; // Chromium-like but the event has not fired (yet), or Firefox

function detectInstallEnv(): InstallEnv {
  if (typeof window === "undefined") return "checking";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari reports installation this way rather than via display-mode.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";

  // A service worker needs a secure context. http://<LAN-IP> is not one, so the
  // app cannot be installed there however correct the manifest is. This is the
  // usual reason "install" appears to do nothing when testing from a phone.
  if (!window.isSecureContext) return "insecure";

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  if (isIOS) return "ios";

  return "manual";
}

export function PwaShell() {
  const [bal, setBal] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("50");
  const [recipient, setRecipient] = useState("Ama Mensah");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"home" | "send" | "assets" | "more">("home");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installEnv, setInstallEnv] = useState<InstallEnv>("checking");

  // Resolved after mount, not during render. The support check reads `window`,
  // so calling it while rendering returns false on the server and true in the
  // browser -- a hydration mismatch, which React recovers from by throwing away
  // the server markup.
  const [canUsePasskeys, setCanUsePasskeys] = useState(false);
  useEffect(() => {
    setCanUsePasskeys(passkeysSupported());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const b = await fetchBalance();
    setBal(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore */
      });
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setInstallEnv("prompt");
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEnv("installed");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const env = detectInstallEnv();
    setInstallEnv(env);
    if (env === "installed") setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) {
      // No prompt available. Say why, rather than doing nothing.
      setMsg(installHelp(installEnv));
      setTab("more");
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setInstallEnv("installed");
    }
    setDeferred(null);
  }

  async function onRegisterPasskey() {
    setBusy(true);
    setMsg(null);
    const r = await registerPasskey(DEMO_SUBJECT, "EPHERA Demo");
    setMsg(r.message);
    setBusy(false);
  }

  async function onSend(full = false) {
    setBusy(true);
    setMsg(null);
    const minor = Math.round((Number(amount) || 0) * 100);
    if (minor <= 0 || !recipient.trim()) {
      setMsg("Enter amount and recipient");
      setBusy(false);
      return;
    }
    if (!full) {
      const q = await prepareTransfer({ amountMinor: minor, recipientName: recipient });
      setMsg(q.message);
      setBusy(false);
      return;
    }
    const r = await sendTransfer({ amountMinor: minor, recipientName: recipient });
    if (r.needsRegistration) {
      // Offer to register a passkey, then the user taps send again.
      setMsg(`${r.message} Tap "Register passkey" below, then send.`);
      setBusy(false);
      return;
    }
    setMsg(r.message);
    if (r.ok) await refresh();
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", paddingBottom: 88 }}>
      {/* Install / download app banner */}
      <div className={`install-banner${deferred && !installed ? " show" : ""}`}>
        <img src="/icons/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Install EPHERA</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Add to home screen / desktop with logo icon
          </div>
        </div>
        <button type="button" className="btn" onClick={() => void install()}>
          Install
        </button>
      </div>

      <header style={{ padding: "20px 20px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <img
          src="/icons/logo-symbol.png"
          alt="EPHERA"
          width={40}
          height={40}
          style={{ filter: "drop-shadow(0 0 12px rgba(244,248,255,0.45))" }}
        />
        <div>
          <div style={{ fontWeight: 300, letterSpacing: "0.28em", fontSize: 18 }}>EPHERA</div>
          <div className="kicker" style={{ color: "var(--muted)" }}>
            Money without limits
          </div>
        </div>
      </header>

      {tab === "home" && (
        <main style={{ padding: 20 }}>
          <div className="glass" style={{ padding: 20, marginBottom: 14 }}>
            <div className="kicker">Total balance</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                marginTop: 8,
                textShadow: "0 0 20px rgba(244,248,255,0.35)",
              }}
            >
              {loading ? "…" : bal ? formatGhs(bal.availableMinor || bal.balanceMinor) : "Offline"}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              Status: {bal?.status ?? "unknown"} · API {PAYMENTS}
            </div>
            {bal?.status === "frozen" ? (
              <div style={{ color: "var(--danger)", marginTop: 8, fontWeight: 700, fontSize: 12 }}>
                Outbound frozen
              </div>
            ) : null}
            <button
              type="button"
              className="btn secondary"
              style={{ marginTop: 14, width: "100%" }}
              onClick={() => void refresh()}
            >
              Refresh balance
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button type="button" className="btn" onClick={() => setTab("send")}>
              Send
            </button>
            <button type="button" className="btn secondary" onClick={() => setTab("assets")}>
              Assets
            </button>
          </div>

          <div className="glass" style={{ padding: 16, marginTop: 14 }}>
            <div className="kicker">Access</div>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55, margin: "8px 0 0" }}>
              This PWA installs on desktop and mobile with the EPHERA logo. High-value passkeys and
              offline voice use the native Expo app. Crypto coins, send and trade (eToro-style) are
              planned in a later release behind licensing.
            </p>
          </div>
        </main>
      )}

      {tab === "send" && (
        <main style={{ padding: 20 }}>
          <div className="kicker">Prepare send</div>
          <h2 style={{ margin: "6px 0 14px", fontSize: 22 }}>Send money</h2>
          <label className="kicker">Recipient</label>
          <input
            className="input"
            style={{ marginTop: 6, marginBottom: 12 }}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <label className="kicker">Amount (GHS)</label>
          <input
            className="input"
            style={{ marginTop: 6, marginBottom: 14 }}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => void onSend(false)}
            >
              Get quote
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void onSend(true)}
            >
              {busy
                ? "Working…"
                : canUsePasskeys
                  ? "Authorise with passkey & send"
                  : "Authorise & send (sandbox)"}
            </button>
            {canUsePasskeys ? (
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => void onRegisterPasskey()}
              >
                Register passkey
              </button>
            ) : null}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.5, marginTop: 10 }}>
            {canUsePasskeys
              ? "Your passkey signs the exact transfer — recipient, amount and fee. A signature for one payment cannot authorise another."
              : "This browser has no passkey support, so the sandbox authenticator is used. It does not prove a person approved the payment."}
          </p>
          {msg ? (
            <div className="glass" style={{ padding: 14, marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>
              {msg}
            </div>
          ) : null}
        </main>
      )}

      {tab === "assets" && (
        <main style={{ padding: 20 }}>
          <div className="kicker">Assets</div>
          <h2 style={{ margin: "6px 0 14px", fontSize: 22 }}>Fiat · Crypto (soon)</h2>
          <div className="glass" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>GHS Wallet</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              Primary mobile-money balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>
              {bal ? formatGhs(bal.availableMinor || bal.balanceMinor) : "—"}
            </div>
          </div>
          <div
            className="glass"
            style={{ padding: 16, opacity: 0.85, borderStyle: "dashed" }}
          >
            <div style={{ fontWeight: 700 }}>Crypto · Trade · Send</div>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55, margin: "8px 0 0" }}>
              Coming next: multi-asset wallets, send crypto, and eToro-style buy/sell with clear
              fees — only where licensed. Not available in this sandbox build.
            </p>
          </div>
        </main>
      )}

      {tab === "more" && (
        <main style={{ padding: 20 }}>
          <div className="kicker">Install & devices</div>
          <h2 style={{ margin: "6px 0 14px", fontSize: 22 }}>Get EPHERA</h2>
          <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
            <strong>Install on this device</strong>
            <p
              style={{
                color: installEnv === "insecure" ? "var(--danger)" : "var(--muted)",
                fontSize: 13,
                lineHeight: 1.55,
                margin: "8px 0 12px",
              }}
            >
              {installHelp(installEnv)}
            </p>
            {/* Always actionable. When the browser cannot install programmatically
                the button explains why rather than being absent. */}
            <button
              type="button"
              className="btn"
              disabled={installEnv === "installed"}
              onClick={() => void install()}
            >
              {installEnv === "prompt"
                ? "Install EPHERA"
                : installEnv === "installed"
                  ? "Already installed"
                  : "Why can’t I install?"}
            </button>
            <p style={{ color: "var(--dim)", fontSize: 11, marginTop: 10 }}>
              Detected: {installEnv}
              {typeof window !== "undefined" && !window.isSecureContext
                ? " · insecure origin"
                : ""}
            </p>
          </div>
          <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
            <strong>iPhone / iPad (Safari)</strong>
            <ol style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, paddingLeft: 18 }}>
              <li>Open the PWA URL in Safari</li>
              <li>Share → Add to Home Screen</li>
              <li>Confirm EPHERA logo on home screen</li>
            </ol>
          </div>
          <div className="glass" style={{ padding: 16 }}>
            <strong>Full native app (Expo)</strong>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
              For the complete product (voice orb, QR camera, passkeys): use Expo Go or a dev build
              on the same Wi‑Fi. See docs/runbooks/MOBILE-ACCESS.md
            </p>
          </div>
        </main>
      )}

      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          borderTop: "1px solid var(--border)",
          background: "rgba(5,11,24,0.94)",
          padding: "8px 6px calc(8px + env(safe-area-inset-bottom))",
        }}
      >
        {(
          [
            ["home", "Home"],
            ["send", "Send"],
            ["assets", "Assets"],
            ["more", "Install"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              color: tab === id ? "var(--tube)" : "var(--dim)",
              fontWeight: tab === id ? 700 : 500,
              fontSize: 11,
              padding: "8px 4px",
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
