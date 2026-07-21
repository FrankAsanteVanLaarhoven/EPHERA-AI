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
    const data = (await res.json()) as TransferResponse;
    if (!res.ok && !data.status) {
      throw new Error(data.error ?? `transfer failed: ${res.status}`);
    }
    return data;
  }
}
