/**
 * Shared PaymentIntent and ephemeral UI contracts.
 * Voice/LLM may propose; policy + user auth must approve.
 */

export type RiskClass = "low" | "medium" | "high" | "critical";

export type IntentName =
  | "send_money"
  | "request_money"
  | "check_balance"
  | "list_transactions"
  | "pay_bill"
  | "buy_airtime"
  | "freeze_wallet"
  | "unfreeze_wallet"
  | "add_recipient"
  | "quote_domestic"
  | "quote_cross_border"
  | "create_payment_link"
  | "create_merchant_checkout"
  | "move_to_savings"
  | "read_fee_breakdown"
  | "change_amount"
  | "cancel_intent"
  | "dispute_transfer"
  | "help"
  | "delete_voice_recording";

export interface MoneyAmount {
  /** Minor units (pesewas, pence). Never floats for money. */
  amountMinor: number;
  currency: string;
}

export interface RecipientRef {
  displayName?: string;
  mobileNumber?: string;
  accountHint?: string;
  verified?: boolean;
  isNew?: boolean;
}

export interface PaymentIntent {
  id: string;
  name: IntentName;
  language: string;
  confidence: number;
  amount?: MoneyAmount;
  recipient?: RecipientRef;
  purpose?: string;
  constraints?: {
    cheapestSafe?: boolean;
    arriveBy?: string;
    receiveCurrency?: string;
  };
  riskClass?: RiskClass;
  rawUtterance?: string;
  createdAt: string;
}

export type PanelType =
  | "payment_confirmation"
  | "quote_compare"
  | "bill_pay"
  | "airtime"
  | "freeze_wallet"
  | "merchant_checkout"
  | "receipt"
  | "clarification";

export interface PaymentConfirmationPanel {
  type: "payment_confirmation";
  intentId: string;
  recipient: {
    name: string;
    verified: boolean;
    accountHint?: string;
  };
  sendAmount: string;
  receiveAmount?: string;
  fee: string;
  fxMarkup?: string;
  eta?: string;
  routeSummary?: string;
  requiresPasskey: boolean;
  actions: Array<"change_route" | "cancel" | "authorise">;
}

export type EphemeralPanel =
  | PaymentConfirmationPanel
  | { type: "clarification"; intentId: string; question: string; options?: string[] }
  | { type: "freeze_wallet"; intentId: string; requiresPasskey: true }
  | { type: "receipt"; transferId: string; summary: string; status: string };

export const SUPPORTED_INTENTS: IntentName[] = [
  "send_money",
  "request_money",
  "check_balance",
  "list_transactions",
  "pay_bill",
  "buy_airtime",
  "freeze_wallet",
  "unfreeze_wallet",
  "add_recipient",
  "quote_domestic",
  "quote_cross_border",
  "create_payment_link",
  "create_merchant_checkout",
  "move_to_savings",
  "read_fee_breakdown",
  "change_amount",
  "cancel_intent",
  "dispute_transfer",
  "help",
  "delete_voice_recording",
];
