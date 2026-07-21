import type { PaymentIntent } from "@ephera/intent-schema";

export interface CompileResult {
  intent: PaymentIntent & { clarification?: string };
  needsClarification: boolean;
  canAuthoriseFromVoiceAlone: false;
  panelHint: string | null;
}

export class VoiceIntentClient {
  constructor(private readonly baseUrl: string) {}

  async compile(text: string, language = "en"): Promise<CompileResult> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) {
      throw new Error(`voice-intent compile failed: ${res.status}`);
    }
    const data = (await res.json()) as CompileResult;
    return { ...data, canAuthoriseFromVoiceAlone: false };
  }
}
