/**
 * Browser WebAuthn encoding helpers.
 *
 * WebAuthn moves binary values (challenges, credential ids, signatures) across
 * three boundaries: the server sends them as base64url JSON, the browser API
 * needs them as ArrayBuffers, and the browser returns ArrayBuffers that the
 * server needs back as base64url JSON. Getting any one of those conversions
 * wrong silently breaks the ceremony, so the conversions live here, are pure,
 * and are unit tested.
 *
 * The `navigator.credentials` calls themselves are in the browser surface, not
 * here, so this module has no DOM dependency and runs under `node --test`.
 */

// A raw credential as the browser returns it. Typed minimally so this module
// needs no DOM lib; a real PublicKeyCredential matches structurally.
export interface RawAttestationCredential {
  id: string;
  rawId: ArrayBuffer;
  type: string;
  response: {
    clientDataJSON: ArrayBuffer;
    attestationObject: ArrayBuffer;
  };
}

export interface RawAssertionCredential {
  id: string;
  rawId: ArrayBuffer;
  type: string;
  response: {
    clientDataJSON: ArrayBuffer;
    authenticatorData: ArrayBuffer;
    signature: ArrayBuffer;
    userHandle: ArrayBuffer | null;
  };
}

export interface RegistrationCredentialJSON {
  id: string;
  rawId: string;
  type: string;
  response: { clientDataJSON: string; attestationObject: string };
}

export interface AuthenticationCredentialJSON {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}

export function bufferToBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** The base64url-encoded fields a creation options object carries. */
interface CreationOptionsJSON {
  publicKey?: Record<string, unknown>;
  [k: string]: unknown;
}

/**
 * Decode server creation options into the shape `navigator.credentials.create`
 * expects, with challenge, user id and any excluded credentials as byte arrays.
 * Returns a plain object; the caller asserts it to PublicKeyCredentialCreationOptions.
 */
export function decodeCreationOptions(json: CreationOptionsJSON): Record<string, unknown> {
  const pk = (json.publicKey ?? json) as Record<string, unknown>;
  const user = pk.user as Record<string, unknown> | undefined;
  const exclude = pk.excludeCredentials as Array<Record<string, unknown>> | undefined;
  return {
    ...pk,
    challenge: base64urlToBytes(pk.challenge as string),
    user: user ? { ...user, id: base64urlToBytes(user.id as string) } : undefined,
    excludeCredentials: exclude?.map((c) => ({ ...c, id: base64urlToBytes(c.id as string) })),
  };
}

/** Decode server request (assertion) options for `navigator.credentials.get`. */
export function decodeRequestOptions(json: CreationOptionsJSON): Record<string, unknown> {
  const pk = (json.publicKey ?? json) as Record<string, unknown>;
  const allow = pk.allowCredentials as Array<Record<string, unknown>> | undefined;
  return {
    ...pk,
    challenge: base64urlToBytes(pk.challenge as string),
    allowCredentials: allow?.map((c) => ({ ...c, id: base64urlToBytes(c.id as string) })),
  };
}

export function encodeRegistrationCredential(
  cred: RawAttestationCredential,
): RegistrationCredentialJSON {
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      attestationObject: bufferToBase64url(cred.response.attestationObject),
    },
  };
}

export function encodeAuthenticationCredential(
  cred: RawAssertionCredential,
): AuthenticationCredentialJSON {
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
      authenticatorData: bufferToBase64url(cred.response.authenticatorData),
      signature: bufferToBase64url(cred.response.signature),
      userHandle: cred.response.userHandle ? bufferToBase64url(cred.response.userHandle) : null,
    },
  };
}
