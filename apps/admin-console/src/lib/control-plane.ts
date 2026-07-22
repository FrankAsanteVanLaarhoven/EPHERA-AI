/**
 * Client for identity-access and platform-control-bff.
 *
 * The console holds no authority of its own. It obtains an operator session by
 * passkey from identity-access, and every state change goes to the control
 * plane as a proposal that a second operator must approve (ADR 0003).
 *
 * There is no password here, and no local notion of "logged in" beyond holding
 * a session the control plane will accept. Losing the token means losing
 * access, which is the intent.
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
  sessionId: string;
};

export type ChangeRequest = {
  ID: string;
  Action: string;
  Target: string;
  Reason: string;
  Status: string;
  RequestedBy: string;
  RequestedAt: string;
  DecidedBy: string | null;
  DecisionNote: string | null;
  ExpiresAt: string;
};

export type AuditRow = {
  seq: number;
  at: string;
  actor: string;
  actorMethod: string;
  action: string;
  target: string;
  outcome: string;
  entryHash: string;
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

/** Register an operator passkey on this device. One-time. */
export async function registerOperatorPasskey(
  subject: string,
): Promise<{ ok: boolean; message: string }> {
  if (!passkeysSupported()) {
    return { ok: false, message: "This browser does not support passkeys." };
  }
  const begin = await identityPost("/v1/passkeys/register/begin", {
    subject,
    displayName: subject,
  });
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
  return { ok: true, message: "Operator passkey registered on this device." };
}

/** Log in with a passkey and keep the resulting session for this tab. */
export async function operatorLogin(
  subject: string,
): Promise<{ ok: boolean; message: string }> {
  if (!passkeysSupported()) {
    return { ok: false, message: "This browser does not support passkeys." };
  }
  const begin = await identityPost("/v1/operators/session/challenge", { subject });
  if (begin.status === 404) {
    return { ok: false, message: "No passkey is registered for this operator. Register one first." };
  }
  if (!begin.ok) return { ok: false, message: `Login could not start (${begin.status}).` };
  const { assertion, challenge } = await begin.json();

  const signed = (await navigator.credentials.get({
    publicKey: decodeRequestOptions(assertion) as unknown as PublicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;
  if (!signed) return { ok: false, message: "Login was cancelled." };

  const finish = await identityPost("/v1/operators/session", {
    subject,
    challenge,
    assertion: encodeAuthenticationCredential(signed as unknown as RawAssertionCredential),
  });
  if (!finish.ok) {
    const err = await finish.json().catch(() => ({}));
    return { ok: false, message: err.message ?? `Login failed (${finish.status}).` };
  }
  const { session } = await finish.json();
  sessionStorage.setItem(SESSION_KEY, session);
  return { ok: true, message: "Signed in with passkey." };
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
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export async function listChanges(): Promise<ChangeRequest[]> {
  try {
    const res = await control("/v1/changes");
    if (!res.ok) return [];
    return ((await res.json()).items ?? []) as ChangeRequest[];
  } catch {
    return [];
  }
}

export async function listAudit(): Promise<AuditRow[]> {
  try {
    const res = await control("/v1/audit");
    if (!res.ok) return [];
    return ((await res.json()).items ?? []) as AuditRow[];
  } catch {
    return [];
  }
}

export async function verifyAuditChain(): Promise<{ intact: boolean; firstBadSeq: number } | null> {
  try {
    const res = await control("/v1/audit/verify");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function message(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.message ?? body.error ?? fallback;
}

export async function proposeChange(input: {
  action: string;
  target: string;
  reason: string;
}): Promise<{ ok: boolean; message: string }> {
  const res = await control("/v1/changes", { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) return { ok: false, message: await message(res, `Proposal refused (${res.status}).`) };
  return { ok: true, message: "Proposed. A different operator must approve it." };
}

export async function decideChange(
  id: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await control(`/v1/changes/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
  if (!res.ok) return { ok: false, message: await message(res, `Decision refused (${res.status}).`) };
  return { ok: true, message: `Change ${decision}.` };
}

export async function applyChange(id: string): Promise<{ ok: boolean; message: string }> {
  const res = await control(`/v1/changes/${id}/apply`, { method: "POST" });
  if (!res.ok) return { ok: false, message: await message(res, `Apply refused (${res.status}).`) };
  return { ok: true, message: "Applied." };
}

export { platformAuthenticatorAvailable } from "@ephera/passkeys";
