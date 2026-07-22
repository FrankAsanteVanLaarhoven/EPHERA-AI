import { test } from "node:test";
import assert from "node:assert/strict";
import {
  constantTimeEqual,
  credentialUsable,
  fingerprintSecret,
  issueApiKey,
  MemoryNonceStore,
  signWebhook,
  verifyWebhookSignature,
} from "./index";

const PEPPER = "test-pepper-not-a-real-one";

test("issued secrets are unpredictable and distinct", async () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const { rawSecret } = await issueApiKey({
      providerId: "p", scopes: ["payments:write"], pepper: PEPPER, environment: "sandbox",
    });
    assert.equal(seen.has(rawSecret), false, "a secret repeated");
    seen.add(rawSecret);
    // 32 random bytes in base64url is 43 characters.
    assert.ok(rawSecret.length > 40, `secret too short: ${rawSecret.length}`);
  }
});

// The old implementation labelled every secret `eph_sk_live_`, sandbox or not.
test("sandbox credentials are not labelled live", async () => {
  const { rawSecret, credential } = await issueApiKey({
    providerId: "p", scopes: [], pepper: PEPPER, environment: "sandbox",
  });
  assert.ok(rawSecret.startsWith("eph_sk_sandbox_"), rawSecret.slice(0, 20));
  assert.ok(credential.publicId.startsWith("eph_pk_sandbox_"));
});

test("the stored fingerprint is not the secret and is stable", async () => {
  const { rawSecret, credential } = await issueApiKey({
    providerId: "p", scopes: [], pepper: PEPPER, environment: "sandbox",
  });
  assert.notEqual(credential.secretFingerprint, rawSecret);
  assert.equal(credential.secretFingerprint.length, 64, "expected a SHA-256 digest");
  assert.equal(await fingerprintSecret(rawSecret, PEPPER), credential.secretFingerprint);
  // A different pepper must not produce the same fingerprint.
  assert.notEqual(await fingerprintSecret(rawSecret, "other-pepper"), credential.secretFingerprint);
});

test("fingerprinting without a pepper is refused", async () => {
  await assert.rejects(() => fingerprintSecret("s", ""));
});

test("constant-time comparison still compares correctly", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "ab"), false);
  assert.equal(constantTimeEqual("", ""), true);
});

test("a valid webhook signature verifies", async () => {
  const nonces = new MemoryNonceStore();
  const now = Date.now();
  const opts = { secret: "s3cret", timestamp: String(Math.floor(now / 1000)), nonce: "n1", body: '{"a":1}' };
  const signature = await signWebhook(opts);
  const res = await verifyWebhookSignature({ ...opts, signature, nonces, now });
  assert.equal(res.ok, true, res.reason);
});

test("a tampered body is rejected", async () => {
  const nonces = new MemoryNonceStore();
  const now = Date.now();
  const opts = { secret: "s3cret", timestamp: String(Math.floor(now / 1000)), nonce: "n1", body: '{"amount":1}' };
  const signature = await signWebhook(opts);
  const res = await verifyWebhookSignature({
    ...opts, body: '{"amount":1000000}', signature, nonces, now,
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "bad_signature");
});

test("a signature made with the wrong secret is rejected", async () => {
  const nonces = new MemoryNonceStore();
  const now = Date.now();
  const opts = { secret: "s3cret", timestamp: String(Math.floor(now / 1000)), nonce: "n1", body: "{}" };
  const signature = await signWebhook({ ...opts, secret: "not-the-secret" });
  const res = await verifyWebhookSignature({ ...opts, signature, nonces, now });
  assert.equal(res.reason, "bad_signature");
});

// The old implementation declared a replay window and recorded nothing, so a
// captured request replayed successfully for its whole window.
test("a replayed request is rejected", async () => {
  const nonces = new MemoryNonceStore();
  const now = Date.now();
  const opts = { secret: "s3cret", timestamp: String(Math.floor(now / 1000)), nonce: "n-replay", body: "{}" };
  const signature = await signWebhook(opts);

  assert.equal((await verifyWebhookSignature({ ...opts, signature, nonces, now })).ok, true);
  const second = await verifyWebhookSignature({ ...opts, signature, nonces, now });
  assert.equal(second.ok, false);
  assert.equal(second.reason, "replayed");
});

// A bad signature must not consume a nonce, or an attacker could burn a
// legitimate sender's nonces by replaying garbage.
test("a failed signature does not consume the nonce", async () => {
  const nonces = new MemoryNonceStore();
  const now = Date.now();
  const opts = { secret: "s3cret", timestamp: String(Math.floor(now / 1000)), nonce: "n-keep", body: "{}" };
  const good = await signWebhook(opts);

  await verifyWebhookSignature({ ...opts, signature: "0".repeat(64), nonces, now });
  const res = await verifyWebhookSignature({ ...opts, signature: good, nonces, now });
  assert.equal(res.ok, true, res.reason);
});

test("clock skew outside the window is rejected", async () => {
  const nonces = new MemoryNonceStore();
  const now = Date.now();
  const opts = { secret: "s", timestamp: String(Math.floor(now / 1000) - 4000), nonce: "n2", body: "{}" };
  const signature = await signWebhook(opts);
  const res = await verifyWebhookSignature({ ...opts, signature, nonces, now });
  assert.equal(res.reason, "timestamp_skew");
});

test("a non-numeric timestamp is rejected", async () => {
  const nonces = new MemoryNonceStore();
  const res = await verifyWebhookSignature({
    secret: "s", timestamp: "not-a-time", nonce: "n", body: "{}",
    signature: "0".repeat(64), nonces,
  });
  assert.equal(res.reason, "bad_timestamp");
});

// Field boundaries must be unambiguous: moving a character between adjacent
// fields must change the signature.
test("adjacent fields cannot be rearranged", async () => {
  const a = await signWebhook({ secret: "s", timestamp: "12", nonce: "ab", body: "c" });
  const b = await signWebhook({ secret: "s", timestamp: "12", nonce: "a", body: "bc" });
  assert.notEqual(a, b);
});

test("expired and revoked credentials are unusable", async () => {
  const { credential } = await issueApiKey({
    providerId: "p", scopes: [], pepper: PEPPER, environment: "sandbox", lifetimeDays: 1,
  });
  assert.equal(credentialUsable(credential), true);
  assert.equal(credentialUsable(credential, new Date(Date.now() + 2 * 86_400_000)), false);
  assert.equal(credentialUsable({ ...credential, status: "revoked" }), false);
});
