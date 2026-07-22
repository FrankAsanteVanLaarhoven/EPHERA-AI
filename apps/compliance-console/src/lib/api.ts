/**
 * Client for the control plane.
 *
 * The console holds no service credential and talks to no service directly. It
 * authenticates its operator with a passkey, and the control plane checks the
 * role and calls compliance-risk with a credential the browser never sees — the
 * opposite of the provider portal, which handed a payments-write secret back in
 * an HTTP response (D-09).
 */

import {
  decodeCreationOptions,
  decodeRequestOptions,
  encodeAuthenticationCredential,
  describePasskeyError,
  encodeRegistrationCredential,
  type RawAssertionCredential,
  type RawAttestationCredential,
} from "@ephera/passkeys";

const IDENTITY = process.env.NEXT_PUBLIC_IDENTITY_URL || "http://localhost:8093";
const CONTROL = process.env.NEXT_PUBLIC_CONTROL_URL || "http://localhost:8094";
const SESSION_KEY = "ephera_operator_session";

export type Me = {
  subject: string;
  roles: string[];
  permissions: string[];
  method: string;
};

export type ReviewCase = {
  id: string;
  subject: string;
  reason: string;
  status: string;
  openedAt: string;
};

export function passkeysSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials?.get === "function"
  );
}

export function storedSession(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
}

async function identityPost(path: string, body: unknown) {
  return fetch(`${IDENTITY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function registerPasskey(subject: string): Promise<{ ok: boolean; message: string }> {
  if (!passkeysSupported()) return { ok: false, message: "This browser does not support passkeys." };
  const begin = await identityPost("/v1/passkeys/register/begin", { subject, displayName: subject });
  if (!begin.ok) return { ok: false, message: `Registration could not start (${begin.status}).` };
  const options = await begin.json();
  const challenge = options.publicKey?.challenge as string;

  let created: PublicKeyCredential | null;
  try {
    created = (await navigator.credentials.create({
      publicKey: decodeCreationOptions(options) as unknown as PublicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;
  } catch (err) {
    return { ok: false, message: describePasskeyError(err) };
  }
  if (!created) return { ok: false, message: "No passkey was created." };

  const finish = await identityPost("/v1/passkeys/register/finish", {
    subject,
    challenge,
    response: encodeRegistrationCredential(created as unknown as RawAttestationCredential),
  });
  if (!finish.ok) {
    const err = await finish.json().catch(() => ({}));
    return { ok: false, message: err.message ?? `Registration failed (${finish.status}).` };
  }
  return { ok: true, message: "Passkey registered on this device." };
}

export async function login(subject: string): Promise<{ ok: boolean; message: string }> {
  if (!passkeysSupported()) return { ok: false, message: "This browser does not support passkeys." };
  const begin = await identityPost("/v1/operators/session/challenge", { subject });
  if (begin.status === 404) {
    return { ok: false, message: "No passkey is registered for this analyst. Register one first." };
  }
  if (!begin.ok) return { ok: false, message: `Sign-in could not start (${begin.status}).` };
  const { assertion, challenge } = await begin.json();

  let signed: PublicKeyCredential | null;
  try {
    signed = (await navigator.credentials.get({
      publicKey: decodeRequestOptions(assertion) as unknown as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;
  } catch (err) {
    return { ok: false, message: describePasskeyError(err) };
  }
  if (!signed) return { ok: false, message: "Sign-in was cancelled." };

  const finish = await identityPost("/v1/operators/session", {
    subject,
    challenge,
    assertion: encodeAuthenticationCredential(signed as unknown as RawAssertionCredential),
  });
  if (!finish.ok) {
    const err = await finish.json().catch(() => ({}));
    return { ok: false, message: err.message ?? `Sign-in failed (${finish.status}).` };
  }
  sessionStorage.setItem(SESSION_KEY, (await finish.json()).session);
  return { ok: true, message: "Signed in." };
}

async function control(path: string, init?: RequestInit) {
  const token = storedSession();
  return fetch(`${CONTROL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await control("/v1/me");
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null;
  }
}

export async function listCases(): Promise<ReviewCase[]> {
  try {
    const res = await control("/v1/compliance/cases");
    if (!res.ok) return [];
    return ((await res.json()).items ?? []) as ReviewCase[];
  } catch {
    return [];
  }
}

async function message(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.message ?? body.error ?? fallback;
}

export async function decideCase(
  id: string,
  status: "cleared" | "blocked",
  note: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await control(`/v1/compliance/cases/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) return { ok: false, message: await message(res, `Refused (${res.status}).`) };
  return { ok: true, message: `Case ${status}.` };
}

export async function fetchSubject(subject: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await control(`/v1/compliance/subjects/${encodeURIComponent(subject)}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export { platformAuthenticatorAvailable } from "@ephera/passkeys";
