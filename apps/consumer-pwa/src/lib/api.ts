const PAYMENTS =
  process.env.NEXT_PUBLIC_PAYMENTS_URL || "http://localhost:8090";

export type Balance = {
  balanceMinor: number;
  availableMinor: number;
  status: string;
  currency: string;
};

export async function fetchBalance(
  ref = "user:demo-self:GHS",
): Promise<Balance | null> {
  try {
    const res = await fetch(
      `${PAYMENTS}/v1/balances/${encodeURIComponent(ref)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      balanceMinor: Number(data.balanceMinor ?? 0),
      availableMinor: Number(data.availableMinor ?? data.balanceMinor ?? 0),
      status: String(data.status ?? "active"),
      currency: String(data.currency ?? "GHS"),
    };
  } catch {
    return null;
  }
}

export function formatGhs(minor: number) {
  return `GH₵ ${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function prepareTransfer(body: {
  amountMinor: number;
  recipientName: string;
}): Promise<{ ok: boolean; message: string; data?: unknown }> {
  try {
    const res = await fetch(`${PAYMENTS}/v1/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: body.amountMinor,
        currency: "GHS",
        rail: "mobile-money-sim",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: data.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      message: `Quote ready · fee GH₵ ${((data.feeMinor ?? 0) / 100).toFixed(2)} · ${data.eta ?? "under 2 min"}`,
      data,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Network error",
    };
  }
}

export async function sendTransfer(body: {
  amountMinor: number;
  recipientName: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${PAYMENTS}/v1/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: body.amountMinor,
        currency: "GHS",
        recipientName: body.recipientName,
        rail: "mobile-money-sim",
        authorisationRef: `passkey_pwa_${Date.now()}`,
        idempotencyKey: `pwa_${Date.now()}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && data.status !== "settled") {
      return {
        ok: false,
        message: data.message ?? data.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      message: `Settled · ${data.transferId ?? "ok"} · ${data.status ?? "settled"}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Network error",
    };
  }
}

export { PAYMENTS };
