import type { PaymentIntent, PaymentConfirmationPanel } from "@ephera/intent-schema";
import { validatePaymentIntent } from "@ephera/validation";

export interface Quote {
  sendAmount: string;
  receiveAmount: string;
  fee: string;
  fxMarkup?: string;
  eta: string;
  routeSummary: string;
}

export interface EpheraClientOptions {
  baseUrl: string;
  /** Sandbox only — never ship live provider secrets to clients */
  apiKey?: string;
}

/**
 * Browser/server TypeScript client skeleton.
 * High-risk authorisation must complete on a trusted device (passkey).
 */
export class EpheraPaymentClient {
  constructor(private readonly opts: EpheraClientOptions) {}

  validateIntent(intent: PaymentIntent) {
    return validatePaymentIntent(intent);
  }

  /** Builds a trusted confirmation panel schema from intent + quote (sandbox). */
  buildConfirmationPanel(
    intent: PaymentIntent,
    quote: Quote,
  ): PaymentConfirmationPanel {
    const issues = validatePaymentIntent(intent);
    if (issues.some((i) => i.code === "low_confidence")) {
      throw new Error("Cannot build authorise panel for low-confidence intent");
    }
    const name = intent.recipient?.displayName ?? intent.recipient?.mobileNumber ?? "Unknown";
    return {
      type: "payment_confirmation",
      intentId: intent.id,
      recipient: {
        name,
        verified: Boolean(intent.recipient?.verified),
        accountHint: intent.recipient?.accountHint,
      },
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      fee: quote.fee,
      fxMarkup: quote.fxMarkup,
      eta: quote.eta,
      routeSummary: quote.routeSummary,
      requiresPasskey: true,
      actions: ["change_route", "cancel", "authorise"],
    };
  }

  async createPaymentLink(_input: {
    amountMinor: number;
    currency: string;
    description: string;
  }): Promise<{ url: string; id: string }> {
    // Gate 2 will call merchant service; sandbox stub:
    const id = `plink_sim_${Date.now()}`;
    return {
      id,
      url: `${this.opts.baseUrl.replace(/\/$/, "")}/pay/${id}`,
    };
  }
}
