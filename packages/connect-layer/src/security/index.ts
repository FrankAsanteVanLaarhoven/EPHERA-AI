/**
 * Credential and webhook security for provider connections.
 *
 * # What changed and why
 *
 * The previous version of this file named a set of controls and implemented
 * none of them (deviation D-10):
 *
 *   - `fingerprintSecret` was a 32-bit unsalted Java-style string hash, used as
 *     a key-derivation function. Trivially preimaged.
 *   - `issueApiKey` generated secrets with `Math.random()` — not a CSPRNG, and
 *     recoverable from observed output — and labelled them `eph_sk_live_`.
 *   - `verifyHmacSignature` computed no HMAC. It hashed
 *     `secret.timestamp.body` with that same 32-bit function and compared the
 *     result with `!==`, which is neither a MAC nor a constant-time comparison.
 *   - The policy objects requiring mutual TLS, IP allowlists and envelope
 *     encryption were referenced by nothing.
 *
 * Everything here now uses the Web Crypto API: CSPRNG secrets, HMAC-SHA-256,
 * and constant-time comparison. Replay protection is a real nonce store rather
 * than a number in a struct that nothing read.
 *
 * What this file deliberately does NOT claim: it does not do mutual TLS, key
 * management, or envelope encryption. Those need infrastructure this codebase
 * does not have, so they are absent rather than represented by a boolean.
 */

export type CredentialStatus = "active" | "rotated" | "revoked";

export interface ConnectorCredential {
  id: string;
  providerId: string;
  kind: "api_key";
  publicId: string;
  /** HMAC-SHA-256 of the secret under a server-held pepper. Not reversible. */
  secretFingerprint: string;
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
  status: CredentialStatus;
}

const encoder = new TextEncoder();

function requireCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle || typeof c.getRandomValues !== "function") {
    // Failing loudly is the point. Silently degrading to a weaker source is how
    // the previous implementation came to use Math.random().
    throw new Error("Web Crypto is unavailable; refusing to generate or verify credentials");
  }
  return c;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** base64url of cryptographically random bytes. */
function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  requireCrypto().getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const crypto = requireCrypto();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return new Uint8Array(sig);
}

/**
 * Compare two hex strings without leaking where they differ.
 *
 * Length is compared first and non-constant-time, which is acceptable: these
 * are fixed-width digests, so the length carries no secret.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Fingerprint a secret for storage: HMAC-SHA-256 under a server-held pepper.
 *
 * The pepper means a stolen database of fingerprints cannot be attacked
 * offline without also stealing the pepper. It is not a password hash and does
 * not need to be — the input is 256 bits of CSPRNG output, not a human-chosen
 * secret, so there is nothing to brute force.
 */
export async function fingerprintSecret(secret: string, pepper: string): Promise<string> {
  if (!pepper) {
    throw new Error("a pepper is required to fingerprint a credential secret");
  }
  return toHex(await hmacSha256(pepper, secret));
}

export interface IssuedCredential {
  credential: ConnectorCredential;
  /** Shown once, never stored, and never returned again. */
  rawSecret: string;
}

/**
 * Mint an API key.
 *
 * `environment` is part of the visible prefix so a sandbox credential cannot be
 * mistaken for a production one in a log or a screenshot. The previous version
 * labelled every secret `eph_sk_live_`, including sandbox ones.
 */
export async function issueApiKey(opts: {
  providerId: string;
  scopes: string[];
  pepper: string;
  environment: "sandbox" | "live";
  lifetimeDays?: number;
}): Promise<IssuedCredential> {
  const rawSecret = `eph_sk_${opts.environment}_${randomToken(32)}`;
  const publicId = `eph_pk_${opts.environment}_${randomToken(9)}`;
  const now = new Date();
  const expiresAt =
    opts.lifetimeDays === undefined
      ? undefined
      : new Date(now.getTime() + opts.lifetimeDays * 86_400_000).toISOString();

  return {
    rawSecret,
    credential: {
      id: `cred_${randomToken(12)}`,
      providerId: opts.providerId,
      kind: "api_key",
      publicId,
      secretFingerprint: await fingerprintSecret(rawSecret, opts.pepper),
      scopes: opts.scopes,
      createdAt: now.toISOString(),
      expiresAt,
      status: "active",
    },
  };
}

/** A credential is usable only while active and unexpired. */
export function credentialUsable(c: ConnectorCredential, now = new Date()): boolean {
  if (c.status !== "active") return false;
  if (c.expiresAt && new Date(c.expiresAt) <= now) return false;
  return true;
}

/**
 * Seen-nonce store for replay protection.
 *
 * The previous implementation declared a replay window and never recorded
 * anything, so a captured request replayed successfully for its whole window.
 */
export interface NonceStore {
  /** Returns false if this nonce has been seen before. */
  claim(nonce: string, expiresAt: number): boolean;
}

export class MemoryNonceStore implements NonceStore {
  private seen = new Map<string, number>();

  claim(nonce: string, expiresAt: number): boolean {
    const now = Date.now();
    for (const [k, exp] of this.seen) if (exp <= now) this.seen.delete(k);
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, expiresAt);
    return true;
  }
}

export interface WebhookVerification {
  ok: boolean;
  reason?: "bad_timestamp" | "timestamp_skew" | "replayed" | "bad_signature";
}

/**
 * Verify a webhook signature: HMAC-SHA-256 over `timestamp.nonce.body`.
 *
 * The signed string is built from length-prefixed parts so no combination of
 * values can be rearranged into a different message with the same signature.
 */
export async function signWebhook(opts: {
  secret: string;
  timestamp: string;
  nonce: string;
  body: string;
}): Promise<string> {
  return toHex(await hmacSha256(opts.secret, signingString(opts)));
}

function signingString(opts: { timestamp: string; nonce: string; body: string }): string {
  const part = (s: string) => `${s.length}:${s}`;
  return [part(opts.timestamp), part(opts.nonce), part(opts.body)].join("|");
}

export async function verifyWebhookSignature(opts: {
  secret: string;
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  maxSkewSeconds?: number;
  nonces: NonceStore;
  now?: number;
}): Promise<WebhookVerification> {
  const maxSkew = opts.maxSkewSeconds ?? 300;
  const nowMs = opts.now ?? Date.now();

  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(nowMs / 1000 - ts) > maxSkew) return { ok: false, reason: "timestamp_skew" };

  const expected = await signWebhook(opts);
  if (!constantTimeEqual(expected, opts.signature)) {
    return { ok: false, reason: "bad_signature" };
  }
  // Claim the nonce only after the signature verifies, so an attacker cannot
  // burn a legitimate sender's nonces by replaying garbage.
  if (!opts.nonces.claim(opts.nonce, nowMs + maxSkew * 1000)) {
    return { ok: false, reason: "replayed" };
  }
  return { ok: true };
}
