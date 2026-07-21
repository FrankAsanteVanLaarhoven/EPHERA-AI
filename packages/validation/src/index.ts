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

  if (intent.name === "send_money") {
    if (!intent.amount) {
      issues.push({ code: "missing_amount", message: "send_money requires amount", field: "amount" });
    } else {
      issues.push(...validateMoney(intent.amount));
    }
    if (!intent.recipient?.displayName && !intent.recipient?.mobileNumber) {
      issues.push({
        code: "missing_recipient",
        message: "send_money requires a recipient",
        field: "recipient",
      });
    }
    if (intent.confidence < 0.75) {
      issues.push({
        code: "low_confidence",
        message: "confidence too low — require clarification before panel authorise",
        field: "confidence",
      });
    }
  }

  return issues;
}

export function canAuthoriseFromVoiceAlone(): false {
  // Hard product rule — encoded as type + runtime.
  return false;
}
