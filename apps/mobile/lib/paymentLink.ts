/**
 * Ephera payment payloads for QR + deep links.
 * Format: ephera://pay?v=1&to=handle&amount=50.00&ccy=GHS&note=...
 * Also accepts https://pay.ephera.money/r/{handle}?amount=&note=
 */

export type PayPayload = {
  version: 1;
  to: string;
  displayName?: string;
  amount?: string;
  currency: string;
  note?: string;
  kind?: "p2p" | "merchant" | "request";
  merchantId?: string;
};

export function buildPayPayload(input: {
  to: string;
  displayName?: string;
  amount?: string;
  currency?: string;
  note?: string;
  kind?: PayPayload["kind"];
  merchantId?: string;
}): PayPayload {
  return {
    version: 1,
    to: input.to.replace(/^@/, ""),
    displayName: input.displayName,
    amount: input.amount?.trim() || undefined,
    currency: input.currency ?? "GHS",
    note: input.note?.trim() || undefined,
    kind: input.kind ?? "p2p",
    merchantId: input.merchantId,
  };
}

export function toDeepLink(p: PayPayload): string {
  const q = new URLSearchParams();
  q.set("v", "1");
  q.set("to", p.to);
  if (p.displayName) q.set("name", p.displayName);
  if (p.amount) q.set("amount", p.amount);
  q.set("ccy", p.currency);
  if (p.note) q.set("note", p.note);
  if (p.kind) q.set("kind", p.kind);
  if (p.merchantId) q.set("mid", p.merchantId);
  return `ephera://pay?${q.toString()}`;
}

export function toHttpsLink(p: PayPayload): string {
  const q = new URLSearchParams();
  if (p.amount) q.set("amount", p.amount);
  if (p.note) q.set("note", p.note);
  q.set("ccy", p.currency);
  if (p.kind) q.set("kind", p.kind);
  return `https://pay.ephera.money/r/${encodeURIComponent(p.to)}?${q.toString()}`;
}

/** Value encoded in QR — deep link preferred for app scan. */
export function toQrValue(p: PayPayload): string {
  return toDeepLink(p);
}

export function parsePayPayload(raw: string): PayPayload | null {
  try {
    const text = raw.trim();
    if (!text) return null;

    // ephera://pay?...
    if (text.startsWith("ephera://pay")) {
      const u = new URL(text.replace("ephera://", "https://x/"));
      const to = u.searchParams.get("to");
      if (!to) return null;
      return {
        version: 1,
        to,
        displayName: u.searchParams.get("name") ?? undefined,
        amount: u.searchParams.get("amount") ?? undefined,
        currency: u.searchParams.get("ccy") ?? "GHS",
        note: u.searchParams.get("note") ?? undefined,
        kind: (u.searchParams.get("kind") as PayPayload["kind"]) ?? "p2p",
        merchantId: u.searchParams.get("mid") ?? undefined,
      };
    }

    // https://pay.ephera.money/r/{handle}?...
    if (text.includes("pay.ephera.money")) {
      const u = new URL(text.startsWith("http") ? text : `https://${text}`);
      const parts = u.pathname.split("/").filter(Boolean);
      const to = parts[parts.length - 1];
      if (!to) return null;
      return {
        version: 1,
        to: decodeURIComponent(to),
        amount: u.searchParams.get("amount") ?? undefined,
        currency: u.searchParams.get("ccy") ?? "GHS",
        note: u.searchParams.get("note") ?? undefined,
        kind: (u.searchParams.get("kind") as PayPayload["kind"]) ?? "p2p",
      };
    }

    // JSON fallback
    if (text.startsWith("{")) {
      const j = JSON.parse(text) as Partial<PayPayload>;
      if (!j.to) return null;
      return {
        version: 1,
        to: String(j.to).replace(/^@/, ""),
        displayName: j.displayName,
        amount: j.amount,
        currency: j.currency ?? "GHS",
        note: j.note,
        kind: j.kind ?? "p2p",
        merchantId: j.merchantId,
      };
    }

    // Bare @handle or handle
    if (/^@?[\w.]{2,32}$/.test(text)) {
      return {
        version: 1,
        to: text.replace(/^@/, ""),
        currency: "GHS",
        kind: "p2p",
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function amountToMinor(amount?: string): number | undefined {
  if (!amount) return undefined;
  const n = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

export function formatGhsInput(amount?: string) {
  if (!amount) return "";
  const n = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n)) return amount;
  return `GH₵ ${n.toFixed(2)}`;
}
