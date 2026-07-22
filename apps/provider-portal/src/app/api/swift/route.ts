import { NextResponse } from "next/server";
import { forbidden, sessionFromRequest, unauthorised } from "@/lib/session";
import { SANDBOX_BIC_DIRECTORY, type SwiftMessageType } from "@ephera/connect-layer";
import { providerStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // This GET was unauthenticated and returned every provider's cross-border
  // messages (sender/receiver BIC, amount, purpose) to any caller — the POST
  // beside it was gated but the GET was not (D-08). It is now authenticated and
  // scoped to the caller's own applications.
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  return NextResponse.json({
    directory: SANDBOX_BIC_DIRECTORY,
    messages: providerStore.swiftForOwner(auth.session.sub),
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
  // The application must belong to the caller — otherwise any authenticated
  // provider could queue messages against another provider's application.
  if (!providerStore.ownedBy(body.applicationId, auth.session.sub)) {
    return forbidden("This application belongs to a different provider.");
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
