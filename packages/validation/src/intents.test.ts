import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePaymentIntent } from "./index";
import type { PaymentIntent } from "@ephera/intent-schema";

const base = (over: Partial<PaymentIntent>): PaymentIntent => ({
  intentId: "i1",
  name: "pay_bill",
  confidence: 0.99,
  ...over,
}) as PaymentIntent;

// The regression: money-moving intents other than send_money used to skip
// every check. A bill payment with a negative amount must be rejected.
for (const name of ["pay_bill", "buy_airtime", "move_to_savings"] as const) {
  test(`${name} with a negative amount is rejected`, () => {
    const issues = validatePaymentIntent(base({ name, amount: { currency: "GHS", amountMinor: -500 } }));
    assert.ok(issues.some((i) => i.code === "non_positive_amount"), `${name} accepted a negative amount`);
  });

  test(`${name} with no amount is rejected`, () => {
    const issues = validatePaymentIntent(base({ name, amount: undefined }));
    assert.ok(issues.some((i) => i.code === "missing_amount"), `${name} accepted a missing amount`);
  });

  test(`${name} at low confidence raises low_confidence`, () => {
    const issues = validatePaymentIntent(base({ name, confidence: 0.4, amount: { currency: "GHS", amountMinor: 100 } }));
    assert.ok(issues.some((i) => i.code === "low_confidence"), `${name} did not gate on low confidence`);
  });
}

test("a read-only intent is not forced to carry an amount", () => {
  const issues = validatePaymentIntent(base({ name: "check_balance", amount: undefined }));
  assert.equal(issues.length, 0);
});

test("send_money still requires a recipient", () => {
  const issues = validatePaymentIntent(base({ name: "send_money", amount: { currency: "GHS", amountMinor: 100 } }));
  assert.ok(issues.some((i) => i.code === "missing_recipient"));
});
