import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAuthoriseFromVoiceAlone,
  validateMoney,
  validatePaymentIntent,
} from "./index";
import type { PaymentIntent } from "@ephera/intent-schema";

describe("validateMoney", () => {
  it("rejects float-like non integers", () => {
    const issues = validateMoney({ amountMinor: 10.5 as unknown as number, currency: "GHS" });
    assert.ok(issues.some((i) => i.code === "non_integer_amount"));
  });

  it("accepts positive minor units", () => {
    assert.equal(validateMoney({ amountMinor: 1500, currency: "GHS" }).length, 0);
  });
});

describe("validatePaymentIntent", () => {
  it("blocks low-confidence send", () => {
    const intent: PaymentIntent = {
      id: "1",
      name: "send_money",
      language: "en",
      confidence: 0.4,
      amount: { amountMinor: 5000, currency: "GHS" },
      recipient: { displayName: "Ama" },
      createdAt: new Date().toISOString(),
    };
    const issues = validatePaymentIntent(intent);
    assert.ok(issues.some((i) => i.code === "low_confidence"));
  });

  it("never allows voice-only authorisation", () => {
    assert.equal(canAuthoriseFromVoiceAlone(), false);
  });
});
