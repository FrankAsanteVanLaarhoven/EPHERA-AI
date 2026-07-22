import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base64urlToBytes,
  bufferToBase64url,
  decodeCreationOptions,
  decodeRequestOptions,
  encodeAuthenticationCredential,
  encodeRegistrationCredential,
} from "./webauthn";

test("base64url round-trips arbitrary bytes", () => {
  for (let len = 0; len < 40; len++) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 11) & 0xff;
    const round = base64urlToBytes(bufferToBase64url(bytes));
    assert.deepEqual(Array.from(round), Array.from(bytes));
  }
});

test("base64url output is url-safe and unpadded", () => {
  // 0xff 0xff 0xff would be /// in standard base64.
  const s = bufferToBase64url(new Uint8Array([0xff, 0xff, 0xff, 0xfb, 0xff]));
  assert.equal(/[+/=]/.test(s), false, `expected url-safe unpadded, got ${s}`);
});

test("base64url decodes the server's URLEncodedBase64 (go-webauthn)", () => {
  // Values Go's protocol.URLEncodedBase64 produces are url-safe and unpadded.
  const bytes = base64urlToBytes("AQIDBA"); // 01 02 03 04
  assert.deepEqual(Array.from(bytes), [1, 2, 3, 4]);
});

test("decodeCreationOptions turns challenge and user id into bytes", () => {
  const server = {
    publicKey: {
      challenge: bufferToBase64url(new Uint8Array([9, 8, 7])),
      rp: { id: "ephera.test", name: "EPHERA" },
      user: {
        id: bufferToBase64url(new Uint8Array([1, 2, 3, 4])),
        name: "user:demo-self:GHS",
        displayName: "Demo",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      excludeCredentials: [
        { type: "public-key", id: bufferToBase64url(new Uint8Array([5, 6])) },
      ],
    },
  };
  const opts = decodeCreationOptions(server);
  assert.ok(opts.challenge instanceof Uint8Array);
  assert.deepEqual(Array.from(opts.challenge as Uint8Array), [9, 8, 7]);
  const user = opts.user as { id: Uint8Array };
  assert.deepEqual(Array.from(user.id), [1, 2, 3, 4]);
  const exclude = opts.excludeCredentials as Array<{ id: Uint8Array }>;
  assert.deepEqual(Array.from(exclude[0].id), [5, 6]);
  // Non-binary fields pass through untouched.
  assert.equal((opts.rp as { id: string }).id, "ephera.test");
});

test("decodeRequestOptions decodes the challenge that is the transaction digest", () => {
  const digestBytes = new Uint8Array(32).map((_, i) => i);
  const server = {
    publicKey: {
      challenge: bufferToBase64url(digestBytes),
      allowCredentials: [
        { type: "public-key", id: bufferToBase64url(new Uint8Array([1])) },
      ],
    },
  };
  const opts = decodeRequestOptions(server);
  assert.deepEqual(Array.from(opts.challenge as Uint8Array), Array.from(digestBytes));
});

test("encodeRegistrationCredential produces the server's expected JSON", () => {
  const enc = new TextEncoder();
  const cred = {
    id: "cred-id",
    rawId: enc.encode("cred-id").buffer,
    type: "public-key",
    response: {
      clientDataJSON: enc.encode('{"type":"webauthn.create"}').buffer,
      attestationObject: new Uint8Array([0xa0]).buffer,
    },
  };
  const json = encodeRegistrationCredential(cred);
  assert.equal(json.type, "public-key");
  // Every binary field must be a url-safe string.
  assert.equal(/[+/=]/.test(json.rawId), false);
  assert.equal(/[+/=]/.test(json.response.clientDataJSON), false);
  assert.equal(/[+/=]/.test(json.response.attestationObject), false);
  // And must round-trip.
  assert.deepEqual(
    Array.from(base64urlToBytes(json.response.attestationObject)),
    [0xa0],
  );
});

test("encodeAuthenticationCredential handles a null userHandle", () => {
  const buf = new Uint8Array([1, 2]).buffer;
  const withHandle = encodeAuthenticationCredential({
    id: "c",
    rawId: buf,
    type: "public-key",
    response: {
      clientDataJSON: buf,
      authenticatorData: buf,
      signature: buf,
      userHandle: new Uint8Array([9]).buffer,
    },
  });
  assert.equal(withHandle.response.userHandle, bufferToBase64url(new Uint8Array([9])));

  const noHandle = encodeAuthenticationCredential({
    id: "c",
    rawId: buf,
    type: "public-key",
    response: {
      clientDataJSON: buf,
      authenticatorData: buf,
      signature: buf,
      userHandle: null,
    },
  });
  assert.equal(noHandle.response.userHandle, null);
});
