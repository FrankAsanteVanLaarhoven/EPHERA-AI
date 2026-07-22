/**
 * Verifies the operator/provider session tokens minted by identity-access.
 *
 * This is a verifier only — it holds no private key and cannot mint anything.
 * The format matches `services/authgrant/session`: base64url(payload JSON),
 * a dot, then an Ed25519 signature over the encoded payload bytes exactly as
 * transmitted.
 *
 * It exists because the portal previously had no authentication at all: three
 * endpoints returned every provider's legal identity, tax ID, contacts and
 * compliance documents to any caller, and a caller could approve itself
 * (D-08, D-09).
 */

import { createPublicKey, verify as verifySignature } from "node:crypto";

const VERSION = "ephera-operator-session/1";
const ISSUER = "ephera-identity-access";
const MAX_LIFETIME_SECONDS = 30 * 60;
const MAX_CLOCK_SKEW_SECONDS = 30;

export interface SessionPayload {
  v: string;
  jti: string;
  iss: string;
  sub: string;
  roles: string[];
  method: string;
  iat: number;
  exp: number;
}

export type SessionResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; reason: string };

function publicKeyFromHex(hex: string) {
  const raw = Buffer.from(hex, "hex");
  if (raw.length !== 32) throw new Error("session public key must be 32 bytes of hex");
  // SPKI prefix for Ed25519, so node:crypto will accept the raw key bytes.
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    raw,
  ]);
  return createPublicKey({ key: spki, format: "der", type: "spki" });
}

function base64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Verify a session token. Fails closed on every error path, including a
 * missing public key: a portal that cannot tell a real session from a forged
 * one must refuse both.
 */
export function verifySession(token: string, nowMs = Date.now()): SessionResult {
  const hexKey = process.env.PORTAL_SESSION_PUBLIC_KEY;
  if (!hexKey) return { ok: false, reason: "no session public key configured" };

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };
  const encoded = token.slice(0, dot);
  const signature = base64urlToBuffer(token.slice(dot + 1));

  let key;
  try {
    key = publicKeyFromHex(hexKey);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "bad key" };
  }

  // Signature first: nothing inside the payload is trusted until it verifies.
  if (!verifySignature(null, Buffer.from(encoded, "utf8"), key, signature)) {
    return { ok: false, reason: "bad signature" };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64urlToBuffer(encoded).toString("utf8")) as SessionPayload;
  } catch {
    return { ok: false, reason: "payload is not JSON" };
  }

  if (payload.v !== VERSION) return { ok: false, reason: "unrecognised version" };
  if (payload.iss !== ISSUER) return { ok: false, reason: "unrecognised issuer" };
  if (!payload.sub || !Array.isArray(payload.roles) || payload.roles.length === 0) {
    return { ok: false, reason: "sub and roles are required" };
  }
  if (payload.exp - payload.iat > MAX_LIFETIME_SECONDS) {
    return { ok: false, reason: "lifetime exceeds the permitted maximum" };
  }
  const nowSec = nowMs / 1000;
  if (nowSec + MAX_CLOCK_SKEW_SECONDS < payload.iat) return { ok: false, reason: "not yet valid" };
  if (nowSec - MAX_CLOCK_SKEW_SECONDS > payload.exp) return { ok: false, reason: "expired" };

  return { ok: true, session: payload };
}

/** Reads the bearer token and verifies it. */
export function sessionFromRequest(req: Request): SessionResult {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "missing bearer session" };
  }
  return verifySession(header.slice(7).trim());
}

export function unauthorised(reason: string): Response {
  return new Response(
    JSON.stringify({ error: "authentication_required", message: reason }),
    { status: 401, headers: { "content-type": "application/json" } },
  );
}

export function forbidden(message: string): Response {
  return new Response(
    JSON.stringify({ error: "forbidden", message }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}
