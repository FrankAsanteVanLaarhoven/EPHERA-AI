import { test } from "node:test";
import assert from "node:assert/strict";
import { EpheraPaymentClient } from "./index";
import type { PaymentIntent } from "@ephera/intent-schema";

const quote = {
  sendAmount: "GHS 50.00",
  receiveAmount: "GHS 50.00",
  fee: "GHS 0.00",
  fxMarkup: "0%",
  eta: "instant",
  routeSummary: "sim",
};

const intent = (over: Partial<PaymentIntent>): PaymentIntent => ({
  id: "i1", intentId: "i1", name: "send_money", confidence: 0.99,
  amount: { currency: "GHS", amountMinor: 5000 },
  recipient: { displayName: "Ama" },
  ...over,
}) as PaymentIntent;

// A low-confidence intent must never reach an authorise panel: the user should
// be asked to clarify, not to approve something the parser was unsure about.
test("a low-confidence intent cannot build an authorise panel", () => {
  const sdk = new EpheraPaymentClient({ baseUrl: "http://x" });
  assert.throws(() => sdk.buildConfirmationPanel(intent({ confidence: 0.4 }), quote));
});

test("a valid intent builds a panel that requires a passkey", () => {
  const sdk = new EpheraPaymentClient({ baseUrl: "http://x" });
  const panel = sdk.buildConfirmationPanel(intent({}), quote);
  assert.equal(panel.requiresPasskey, true);
  assert.ok(panel.actions.includes("authorise"));
});
