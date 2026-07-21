import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MockPasskeys } from "./index";

describe("MockPasskeys", () => {
  it("requires transaction binding", async () => {
    const p = new MockPasskeys();
    const bad = await p.authorise({
      transferId: "",
      amountMinor: 0,
      currency: "GHS",
      recipientName: "",
      challengeSummary: "",
    });
    assert.equal(bad.ok, false);
  });

  it("returns authorisation ref", async () => {
    const p = new MockPasskeys();
    const ok = await p.authorise({
      transferId: "tx_1",
      amountMinor: 5000,
      currency: "GHS",
      recipientName: "Ama",
      challengeSummary: "Send GHS 50 to Ama",
    });
    assert.equal(ok.ok, true);
    assert.ok(ok.authorisationRef.startsWith("passkey_mock_"));
  });
});
