/**
 * Browser side of the passkey ceremony.
 *
 * The pure encoding lives in @ephera/passkeys and is unit tested. This file is
 * the thin layer that calls `navigator.credentials`, which cannot run outside a
 * real browser with a secure context and an authenticator.
 *
 * The authorisation ceremony's challenge is the transfer's binding digest
 * (issued by identity-access), so the passkey signs the exact transaction.
 */

import {
  decodeCreationOptions,
  decodeRequestOptions,
  encodeAuthenticationCredential,
  describePasskeyError,
  encodeRegistrationCredential,
  type AuthenticationCredentialJSON,
  type RawAssertionCredential,
  type RawAttestationCredential,
  type RegistrationCredentialJSON,
} from "@ephera/passkeys";

const IDENTITY =
  process.env.NEXT_PUBLIC_IDENTITY_URL || "http://localhost:8093";

export function passkeysSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

async function postJSON(path: string, body: unknown): Promise<Response> {
  return fetch(`${IDENTITY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Register a passkey for this subject. One-time, per device. */
export async function registerPasskey(
  subject: string,
  displayName: string,
): Promise<{ ok: boolean; message: string }> {
  if (!passkeysSupported()) {
    return { ok: false, message: "This browser does not support passkeys." };
  }
  const beginRes = await postJSON("/v1/passkeys/register/begin", { subject, displayName });
  if (!beginRes.ok) {
    return { ok: false, message: `Registration could not start (${beginRes.status}).` };
  }
  const options = await beginRes.json();
  const challenge = options.publicKey?.challenge as string;

  // The browser throws on dismissal, timeout and "nothing available to use".
  // Left uncaught this reaches the user as a crash rather than an explanation.
  let created: PublicKeyCredential | null;
  try {
    created = (await navigator.credentials.create({
      publicKey: decodeCreationOptions(options) as unknown as PublicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;
  } catch (err) {
    return { ok: false, message: describePasskeyError(err) };
  }
  if (!created) {
    return { ok: false, message: "No passkey was created." };
  }

  const finishRes = await postJSON("/v1/passkeys/register/finish", {
    subject,
    challenge,
    response: encodeRegistrationCredential(created as unknown as RawAttestationCredential) as RegistrationCredentialJSON,
  });
  if (!finishRes.ok) {
    const err = await finishRes.json().catch(() => ({}));
    return { ok: false, message: err.message ?? `Registration failed (${finishRes.status}).` };
  }
  return { ok: true, message: "Passkey registered on this device." };
}

export interface PreparedTransferFields {
  transferId: string;
  fromExternalRef: string;
  toExternalRef: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
}

/**
 * Obtain a grant by signing the transfer with a registered passkey. Returns the
 * grant string, or null with a reason: `no_passkey` means the subject must
 * register first.
 */
export async function authoriseWithPasskey(
  prepared: PreparedTransferFields,
): Promise<{ grant: string | null; reason?: string; message?: string }> {
  if (!passkeysSupported()) {
    return { grant: null, reason: "unsupported", message: "Passkeys not supported here." };
  }

  const challengeRes = await postJSON("/v1/grants/challenge", {
    subject: prepared.fromExternalRef,
    fromExternalRef: prepared.fromExternalRef,
    toExternalRef: prepared.toExternalRef,
    amountMinor: prepared.amountMinor,
    feeMinor: prepared.feeMinor,
    currency: prepared.currency,
    transferId: prepared.transferId,
  });
  if (challengeRes.status === 404) {
    return { grant: null, reason: "no_passkey", message: "No passkey registered for this account." };
  }
  if (!challengeRes.ok) {
    return { grant: null, reason: "challenge_failed", message: `Challenge failed (${challengeRes.status}).` };
  }
  const { assertion, challenge } = await challengeRes.json();

  let assertionResult: PublicKeyCredential | null;
  try {
    assertionResult = (await navigator.credentials.get({
      publicKey: decodeRequestOptions(assertion) as unknown as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;
  } catch (err) {
    return { grant: null, reason: "cancelled", message: describePasskeyError(err) };
  }
  if (!assertionResult) {
    return { grant: null, reason: "cancelled", message: "Authorisation was cancelled." };
  }

  const finishRes = await postJSON("/v1/grants/passkey", {
    subject: prepared.fromExternalRef,
    fromExternalRef: prepared.fromExternalRef,
    toExternalRef: prepared.toExternalRef,
    amountMinor: prepared.amountMinor,
    feeMinor: prepared.feeMinor,
    currency: prepared.currency,
    transferId: prepared.transferId,
    challenge,
    assertion: encodeAuthenticationCredential(
      assertionResult as unknown as RawAssertionCredential,
    ) as AuthenticationCredentialJSON,
  });
  if (!finishRes.ok) {
    const err = await finishRes.json().catch(() => ({}));
    return { grant: null, reason: "assertion_failed", message: err.message ?? `Authorisation failed (${finishRes.status}).` };
  }
  const { grant } = await finishRes.json();
  return { grant: typeof grant === "string" ? grant : null };
}

export { platformAuthenticatorAvailable } from "@ephera/passkeys";
