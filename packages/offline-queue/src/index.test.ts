import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OfflineQueue, MemoryStorage } from "./index";

describe("OfflineQueue", () => {
  it("rejects enqueue without auth", () => {
    const q = new OfflineQueue(new MemoryStorage());
    assert.throws(() =>
      q.enqueue({
        id: "1",
        kind: "domestic_transfer",
        payload: {},
        authorisationRef: "",
      }),
    );
  });

  it("flushes pending items", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    q.enqueue({
      id: "1",
      kind: "domestic_transfer",
      payload: { amountMinor: 5000 },
      authorisationRef: "passkey_abc",
    });
    const result = await q.flush(async () => ({ ok: true }));
    assert.equal(result.synced, 1);
    assert.equal(q.list()[0].status, "synced");
  });
});

describe("OfflineQueue flush safety", () => {
  it("never retries a permanently rejected payment", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    q.enqueue({ id: "1", kind: "domestic_transfer", payload: {}, authorisationRef: "a" });
    // First flush: the server permanently rejects it.
    await q.flush(async () => ({ ok: false, permanent: true, error: "sanctioned" }));
    assert.equal(q.list()[0].status, "rejected");
    // Second flush must not resend it.
    let calls = 0;
    const res = await q.flush(async () => { calls += 1; return { ok: true }; });
    assert.equal(calls, 0, "a rejected payment was retried");
    assert.equal(res.skipped, 1);
  });

  it("does not resend a synced item on a later flush", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    q.enqueue({ id: "1", kind: "domestic_transfer", payload: {}, authorisationRef: "a" });
    await q.flush(async () => ({ ok: true }));
    let calls = 0;
    await q.flush(async () => { calls += 1; return { ok: true }; });
    assert.equal(calls, 0, "a synced payment was resent");
  });

  it("retries a non-permanent failure", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    q.enqueue({ id: "1", kind: "domestic_transfer", payload: {}, authorisationRef: "a" });
    await q.flush(async () => ({ ok: false, error: "network" }));
    assert.equal(q.list()[0].status, "failed");
    const res = await q.flush(async () => ({ ok: true }));
    assert.equal(res.synced, 1, "a retryable failure was not retried");
  });

  it("does not run two flushes concurrently", async () => {
    const q = new OfflineQueue(new MemoryStorage());
    q.enqueue({ id: "1", kind: "domestic_transfer", payload: {}, authorisationRef: "a" });
    let active = 0;
    let maxActive = 0;
    const slow = async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1; return { ok: true };
    };
    await Promise.all([q.flush(slow), q.flush(slow)]);
    assert.equal(maxActive, 1, "two flushes ran concurrently");
  });
});
