const PAYMENTS =
  process.env.NEXT_PUBLIC_PAYMENTS_URL || "http://localhost:8090";
const IDENTITY =
  process.env.NEXT_PUBLIC_IDENTITY_URL || "http://localhost:8093";

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

/**
 * Send money.
 *
 * Three steps, and the order matters:
 *   1. prepare  -- the server fixes the transfer id, recipient account and fee
 *   2. grant    -- an authorisation bound to exactly those values is obtained
 *   3. transfer -- the prepared transfer is submitted with that grant
 *
 * This surface used to fabricate its own authorisation string from a timestamp
 * (`passkey_pwa_${Date.now()}`), which the payment service accepted (D-31). It
 * can no longer mint one: only identity-access holds the signing key, and the
 * ledger verifies the signature and the binding.
 *
 * The remaining gap is that identity-access does not yet verify a passkey, so
 * the grant it returns is labelled `sandbox_authenticator` end to end. This is
 * not yet proof that a human authorised anything -- see G2-B.
 */
export async function sendTransfer(body: {
  amountMinor: number;
  recipientName: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const prepRes = await fetch(`${PAYMENTS}/v1/transfers/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: body.amountMinor,
        currency: "GHS",
        recipientName: body.recipientName,
        rail: "mobile-money-sim",
        idempotencyKey: `pwa_${Date.now()}`,
      }),
    });
    if (!prepRes.ok) {
      const err = await prepRes.json().catch(() => ({}));
      return { ok: false, message: err.message ?? `Prepare failed: HTTP ${prepRes.status}` };
    }
    const prepared = await prepRes.json();

    const grantRes = await fetch(`${IDENTITY}/v1/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: prepared.fromExternalRef,
        fromExternalRef: prepared.fromExternalRef,
        toExternalRef: prepared.toExternalRef,
        amountMinor: prepared.amountMinor,
        feeMinor: prepared.feeMinor,
        currency: prepared.currency,
        transferId: prepared.transferId,
      }),
    });
    if (!grantRes.ok) {
      const err = await grantRes.json().catch(() => ({}));
      return { ok: false, message: err.message ?? `Authorisation failed: HTTP ${grantRes.status}` };
    }
    const { grant } = await grantRes.json();

    const res = await fetch(`${PAYMENTS}/v1/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferId: prepared.transferId,
        amountMinor: prepared.amountMinor,
        currency: prepared.currency,
        recipientName: body.recipientName,
        fromExternalRef: prepared.fromExternalRef,
        toExternalRef: prepared.toExternalRef,
        rail: prepared.rail,
        authorisationRef: grant,
        idempotencyKey: prepared.idempotencyKey,
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
