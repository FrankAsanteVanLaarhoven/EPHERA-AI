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
