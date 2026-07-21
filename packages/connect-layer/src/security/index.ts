/**
 * Connector security controls for open banking, SWIFT, and provider APIs.
 * Sandbox implementations — production requires HSM, mTLS, and vaulted secrets.
 */

export type SecurityTier = "sandbox" | "staging" | "production";

export type ConnectorCredential = {
  id: string;
  providerId: string;
  kind: "api_key" | "oauth2_client" | "mtls_cert" | "hmac_secret" | "swift_bic_key";
  publicId: string;
  /** Never log full secret in production */
  secretFingerprint: string;
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
  status: "active" | "rotated" | "revoked";
};

export type SecurityPolicy = {
  id: string;
  name: string;
  requiresMtls: boolean;
  requiresIpAllowlist: boolean;
  requiresWebhookHmac: boolean;
  oauthPkce: boolean;
  tokenTtlSeconds: number;
  maxReplayWindowSeconds: number;
  pciScope: boolean;
  piiEncryption: "none" | "field" | "envelope";
};

export const DEFAULT_OPEN_BANKING_POLICY: SecurityPolicy = {
  id: "pol_ob_default",
  name: "Open banking connector policy",
  requiresMtls: true,
  requiresIpAllowlist: true,
  requiresWebhookHmac: true,
  oauthPkce: true,
  tokenTtlSeconds: 900,
  maxReplayWindowSeconds: 300,
  pciScope: false,
  piiEncryption: "envelope",
};

export const DEFAULT_SWIFT_POLICY: SecurityPolicy = {
  id: "pol_swift_default",
  name: "SWIFT / cross-border messaging policy",
  requiresMtls: true,
  requiresIpAllowlist: true,
  requiresWebhookHmac: true,
  oauthPkce: false,
  tokenTtlSeconds: 3600,
  maxReplayWindowSeconds: 600,
  pciScope: false,
  piiEncryption: "envelope",
};

export function fingerprintSecret(secret: string): string {
  // Lightweight sandbox fingerprint (not a production KDF)
  let h = 0;
  for (let i = 0; i < secret.length; i++) h = (Math.imul(31, h) + secret.charCodeAt(i)) | 0;
  return `fp_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function issueApiKey(providerId: string, scopes: string[]): {
  credential: ConnectorCredential;
  rawSecret: string;
} {
  const rawSecret = `eph_sk_live_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const publicId = `eph_pk_${Math.random().toString(36).slice(2, 10)}`;
  return {
    rawSecret,
    credential: {
      id: `cred_${Date.now()}`,
      providerId,
      kind: "api_key",
      publicId,
      secretFingerprint: fingerprintSecret(rawSecret),
      scopes,
      createdAt: new Date().toISOString(),
      status: "active",
    },
  };
}

export function verifyHmacSignature(opts: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  maxSkewSeconds?: number;
}): { ok: boolean; reason?: string } {
  const maxSkew = opts.maxSkewSeconds ?? 300;
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > maxSkew) return { ok: false, reason: "timestamp_skew" };
  // Sandbox: deterministic string compare of pseudo-hmac
  const expected = fingerprintSecret(`${opts.secret}.${opts.timestamp}.${opts.body}`);
  if (expected !== opts.signature) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}
