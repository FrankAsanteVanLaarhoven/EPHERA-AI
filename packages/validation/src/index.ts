import type { MoneyAmount, PaymentIntent } from "@ephera/intent-schema";

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
}

const CURRENCY_RE = /^[A-Z]{3}$/;

export function validateCurrency(code: string): ValidationIssue[] {
  if (!CURRENCY_RE.test(code.toUpperCase())) {
    return [{ code: "invalid_currency", message: `Invalid currency: ${code}`, field: "currency" }];
  }
  return [];
}

export function validateMoney(money: MoneyAmount): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...validateCurrency(money.currency));
  if (!Number.isInteger(money.amountMinor)) {
    issues.push({
      code: "non_integer_amount",
      message: "amountMinor must be an integer (minor units)",
      field: "amountMinor",
    });
  }
  if (money.amountMinor <= 0) {
    issues.push({
      code: "non_positive_amount",
      message: "amount must be positive",
      field: "amountMinor",
    });
  }
  return issues;
}

/**
 * Structural validation only. Does not authorise payment.
 * Low confidence forces clarification — never silent send.
 */
export function validatePaymentIntent(intent: PaymentIntent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (intent.confidence < 0 || intent.confidence > 1) {
    issues.push({
      code: "invalid_confidence",
      message: "confidence must be between 0 and 1",
      field: "confidence",
    });
  }

  // Every intent that moves or commits money must be validated, not only
  // send_money. Previously the amount, recipient and low-confidence checks were
  // inside `if (name === "send_money")`, so pay_bill, buy_airtime,
  // move_to_savings and the rest passed with a missing or negative amount and
  // confidence 0 — and payment-sdk builds an authorise panel unless a
  // low_confidence issue is present, so it would have offered to authorise a
  // low-confidence bill payment.
  if (MONEY_MOVING_INTENTS.has(intent.name)) {
    if (!intent.amount) {
      issues.push({ code: "missing_amount", message: `${intent.name} requires an amount`, field: "amount" });
    } else {
      issues.push(...validateMoney(intent.amount));
    }
    if (RECIPIENT_REQUIRED_INTENTS.has(intent.name)) {
      if (!intent.recipient?.displayName && !intent.recipient?.mobileNumber) {
        issues.push({
          code: "missing_recipient",
          message: `${intent.name} requires a recipient`,
          field: "recipient",
        });
      }
    }
    if (intent.confidence < LOW_CONFIDENCE_THRESHOLD) {
      issues.push({
        code: "low_confidence",
        message: "confidence too low — require clarification before panel authorise",
        field: "confidence",
      });
    }
  }

  return issues;
}

// Intents that move or commit money. Each carries an amount and must clear the
// low-confidence gate before any authorise panel is offered.
const MONEY_MOVING_INTENTS: ReadonlySet<PaymentIntent["name"]> = new Set([
  "send_money",
  "request_money",
  "pay_bill",
  "buy_airtime",
  "move_to_savings",
  "create_payment_link",
  "create_merchant_checkout",
  "quote_domestic",
  "quote_cross_border",
]);

// Of those, the ones that also require a named recipient.
const RECIPIENT_REQUIRED_INTENTS: ReadonlySet<PaymentIntent["name"]> = new Set([
  "send_money",
  "request_money",
]);

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function canAuthoriseFromVoiceAlone(): false {
  // Hard product rule — encoded as type + runtime.
  return false;
}
