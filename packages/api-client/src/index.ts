export interface TransferRequest {
  amountMinor: number;
  currency: string;
  recipientName: string;
  recipientHint?: string;
  rail?: string;
  authorisationRef: string;
  idempotencyKey?: string;
}

export interface TransferResponse {
  transferId: string;
  workflowId?: string;
  status: string;
  executionId?: string;
  providerRef?: string;
  feeMinor?: number;
  routeSummary?: string;
  receiptId?: string;
  message?: string;
  error?: string;
}

export interface QuoteResponse {
  sendAmountMinor: number;
  receiveAmountMinor: number;
  feeMinor: number;
  currency: string;
  eta: string;
  routeSummary: string;
  requiresPasskey: boolean;
}

export class PaymentsClient {
  constructor(private readonly baseUrl: string) {}

  async health(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.ok;
  }

  async quote(amountMinor: number, currency = "GHS", rail = "mobile-money-sim"): Promise<QuoteResponse> {
    const res = await fetch(`${this.baseUrl}/v1/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor, currency, rail }),
    });
    if (!res.ok) throw new Error(`quote failed: ${res.status}`);
    return res.json() as Promise<QuoteResponse>;
  }

  async transfer(req: TransferRequest): Promise<TransferResponse> {
    const res = await fetch(`${this.baseUrl}/v1/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<TransferResponse>;
    // A non-OK response is a failure, full stop. The previous check returned it
    // as success whenever the body carried any `status` field, so a refused or
    // errored transfer that happened to include a status was surfaced to the UI
    // as if it had gone through. The server signals a real outcome with a 2xx
    // and a status; anything else throws with the error detail.
    if (!res.ok) {
      throw new Error(data.error ?? `transfer failed: ${res.status}`);
    }
    return data as TransferResponse;
  }
}
