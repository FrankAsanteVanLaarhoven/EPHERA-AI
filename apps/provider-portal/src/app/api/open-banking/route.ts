import { NextResponse } from "next/server";
import { forbidden, sessionFromRequest, unauthorised } from "@/lib/session";
import { initiatePayment, verifyAccountName } from "@ephera/connect-layer";
import { providerStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Authenticated at G4, but it still returned EVERY provider's bank
  // connections (account masks included), not the caller's. Now owner-scoped
  // (D-08/D-09).
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country") || undefined;
  return NextResponse.json({
    institutions: providerStore.listInstitutions(country || undefined),
    connections: providerStore.connectionsForOwner(auth.session.sub),
  });
}

export async function POST(req: Request) {
  // Gated at G4: this returned every provider's bank connections to any caller (D-08).
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const body = (await req.json()) as {
    action: "link_token" | "exchange" | "verify_name" | "payment";
    applicationId?: string;
    countryCodes?: string[];
    institutionId?: string;
    accountNumber?: string;
    sortOrBankCode?: string;
    expectedName?: string;
    amountMinor?: number;
    currency?: string;
    creditorName?: string;
    reference?: string;
  };

  // Any action that names an application must prove the caller owns it. Without
  // this, an authenticated provider could issue link tokens, complete bank
  // links, and initiate open-banking payments against another provider's
  // application (D-09).
  if (body.applicationId && !providerStore.ownedBy(body.applicationId, auth.session.sub)) {
    return forbidden("This application belongs to a different provider.");
  }

  if (body.action === "link_token") {
    if (!body.applicationId) return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    const token = providerStore.issueLink(body.applicationId, body.countryCodes || ["GH"]);
    return NextResponse.json(token);
  }
  if (body.action === "exchange") {
    if (!body.applicationId || !body.institutionId) {
      return NextResponse.json({ error: "applicationId and institutionId required" }, { status: 400 });
    }
    const conn = providerStore.completeLink(body.applicationId, body.institutionId);
    return NextResponse.json(conn, { status: 201 });
  }
  if (body.action === "verify_name") {
    const r = verifyAccountName({
      accountNumber: body.accountNumber || "",
      sortOrBankCode: body.sortOrBankCode || "",
      expectedName: body.expectedName || "",
    });
    return NextResponse.json(r);
  }
  if (body.action === "payment") {
    const pay = initiatePayment({
      amountMinor: body.amountMinor || 1000,
      currency: body.currency || "GHS",
      creditorName: body.creditorName || "Merchant",
      reference: body.reference || "EPHERA-OB",
    });
    return NextResponse.json(pay, { status: 201 });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
