import { NextResponse } from "next/server";
import { sessionFromRequest, unauthorised } from "@/lib/session";
import { SANDBOX_BIC_DIRECTORY, type SwiftMessageType } from "@ephera/connect-layer";
import { providerStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json({
    directory: SANDBOX_BIC_DIRECTORY,
    messages: providerStore.swiftMessages,
  });
}

export async function POST(req: Request) {
  // Gated at G4: this returned every provider's cross-border messages to any caller (D-08).
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const body = (await req.json()) as {
    applicationId: string;
    type?: SwiftMessageType;
    senderBic: string;
    receiverBic: string;
    currency?: string;
    amountMinor?: number;
    purpose?: string;
  };
  if (!body.applicationId || !body.senderBic || !body.receiverBic) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const msg = providerStore.queueSwift(body.applicationId, {
    type: body.type || "pacs.008",
    senderBic: body.senderBic,
    receiverBic: body.receiverBic,
    currency: body.currency || "USD",
    amountMinor: body.amountMinor || 10000,
    purpose: body.purpose || "Cross-border sandbox transfer",
  });
  return NextResponse.json(msg, { status: 201 });
}
