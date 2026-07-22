import { test } from "node:test";
import assert from "node:assert/strict";
import { PaymentsClient } from "./index";

function withFetch(response: { ok: boolean; status: number; body: unknown }) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  })) as unknown as typeof fetch;
  return () => { globalThis.fetch = orig; };
}

const req = {
  amountMinor: 5000, currency: "GHS", recipientName: "Ama",
  fromExternalRef: "user:a", toExternalRef: "user:b", rail: "mobile-money-sim",
  transferId: "tx_1", authorisationRef: "grant", idempotencyKey: "idem_1",
} as Parameters<PaymentsClient["transfer"]>[0];

// The regression: a non-OK response carrying a status field used to be returned
// as success. A failed transfer must throw, not be surfaced as if it settled.
test("a non-OK transfer response throws even if it carries a status", async () => {
  const restore = withFetch({ ok: false, status: 500, body: { status: "settled" } });
  const c = new PaymentsClient("http://x");
  await assert.rejects(() => c.transfer(req));
  restore();
});

test("a 402 refusal throws with the error detail", async () => {
  const restore = withFetch({ ok: false, status: 402, body: { error: "compliance_denied" } });
  const c = new PaymentsClient("http://x");
  await assert.rejects(() => c.transfer(req), /compliance_denied/);
  restore();
});

test("an OK transfer returns the body", async () => {
  const restore = withFetch({ ok: true, status: 200, body: { transferId: "tx_1", status: "settled" } });
  const c = new PaymentsClient("http://x");
  const out = await c.transfer(req);
  assert.equal(out.status, "settled");
  restore();
});
