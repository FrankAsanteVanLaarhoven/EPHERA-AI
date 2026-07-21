import { NextResponse } from "next/server";
import { SANDBOX_BIC_DIRECTORY, type SwiftMessageType } from "@ephera/connect-layer";
import { providerStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    directory: SANDBOX_BIC_DIRECTORY,
    messages: providerStore.swiftMessages,
  });
}

export async function POST(req: Request) {
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
