import { IDENTITY_URL, PAYMENTS_URL, VOICE_INTENT_URL } from "./config";

export type BalanceResult = {
  balanceMinor: number;
  availableMinor: number;
  holdMinor: number;
  currency: string;
  status: string;
};

/** Quiet fetch — never throws yellow boxes; returns null on failure. */
export async function fetchBalance(
  externalRef = "user:demo-self:GHS",
): Promise<BalanceResult | null> {
  try {
    const res = await fetch(
      `${PAYMENTS_URL}/v1/balances/${encodeURIComponent(externalRef)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      balanceMinor: Number(data.balanceMinor ?? 0),
      availableMinor: Number(data.availableMinor ?? data.balanceMinor ?? 0),
      holdMinor: Number(data.holdMinor ?? 0),
      currency: String(data.currency ?? "GHS"),
      status: String(data.status ?? "active"),
    };
  } catch {
    return null;
  }
}

export type WalletActionResult = {
  ok: boolean;
  status?: string;
  message?: string;
  error?: string;
};

export async function freezeWallet(authorisationRef: string): Promise<WalletActionResult> {
  try {
    const res = await fetch(`${PAYMENTS_URL}/v1/wallet/freeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        externalRef: "user:demo-self:GHS",
        reason: "user_requested_possible_theft",
        authorisationRef,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
        message: data.message ?? data.error,
      };
    }
    return {
      ok: true,
      status: data.status,
      message: data.message ?? "Wallet frozen.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function unfreezeWallet(authorisationRef: string): Promise<WalletActionResult> {
  try {
    const res = await fetch(`${PAYMENTS_URL}/v1/wallet/unfreeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        externalRef: "user:demo-self:GHS",
        authorisationRef,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
        message: data.message ?? data.error,
      };
    }
    return {
      ok: true,
      status: data.status,
      message: data.message ?? "Wallet unfrozen.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type VoiceParseResult = {
  intent?: {
    name?: string;
    amount?: { amountMinor: number; currency: string };
    recipient?: { displayName?: string; accountHint?: string; verified?: boolean };
    confidence?: number;
  };
  raw?: unknown;
};

export async function parseVoiceUtterance(
  text: string,
): Promise<VoiceParseResult | null> {
  try {
    const res = await fetch(`${VOICE_INTENT_URL}/v1/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ text, language: "en" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as VoiceParseResult;
  } catch {
    return null;
  }
}

export function formatGhs(minor: number) {
  const ghs = (minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `GH₵ ${ghs}`;
}

export function formatUsdApprox(ghsMinor: number, rate = 10.08) {
  return `≈ $${(ghsMinor / 100 / rate).toFixed(2)} USD`;
}

/**
 * Prepare + authorise, the two steps that must happen before a transfer.
 *
 * The client no longer manufactures an authorisation string. It asks the
 * payment service to fix the exact transaction, then asks identity-access for
 * a grant bound to those values. Only identity-access holds the signing key,
 * and the ledger verifies the signature, the binding and single use (ADR 0002).
 *
 * Outstanding: identity-access does not yet verify a passkey, so the grant is
 * labelled `sandbox_authenticator` all the way into evidence. It is not yet
 * proof that a human authorised anything -- see G2-B.
 */
export type PreparedTransfer = {
  transferId: string;
  idempotencyKey: string;
  fromExternalRef: string;
  toExternalRef: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  rail: string;
};

export async function prepareTransfer(input: {
  amountMinor: number;
  currency: string;
  recipientName: string;
  recipientHint?: string;
  idempotencyKey: string;
  rail?: string;
}): Promise<PreparedTransfer | null> {
  try {
    const res = await fetch(`${PAYMENTS_URL}/v1/transfers/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: input.amountMinor,
        currency: input.currency,
        recipientName: input.recipientName,
        recipientHint: input.recipientHint,
        rail: input.rail ?? "mobile-money-sim",
        idempotencyKey: input.idempotencyKey,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as PreparedTransfer;
  } catch {
    return null;
  }
}

export async function requestAuthorisationGrant(
  prepared: PreparedTransfer,
): Promise<string | null> {
  try {
    const res = await fetch(`${IDENTITY_URL}/v1/grants`, {
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
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.grant === "string" ? data.grant : null;
  } catch {
    return null;
  }
}
