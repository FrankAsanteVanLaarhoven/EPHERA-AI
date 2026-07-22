import { NextResponse } from "next/server";
import { forbidden, sessionFromRequest, unauthorised } from "@/lib/session";
import { providerStore } from "@/lib/store";
import type { ComplianceDocType, CountryCode } from "@ephera/connect-layer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Gated at G4: this returned document records for any application to any caller (D-08).
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const body = (await req.json()) as {
    applicationId: string;
    type: ComplianceDocType;
    title: string;
    version?: string;
    jurisdiction: CountryCode;
    fileName: string;
  };
  if (!body.applicationId || !body.type || !body.title || !body.fileName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  // A provider may only attach documents to its own application, not to
  // another provider's by guessed id (D-09).
  if (!providerStore.ownedBy(body.applicationId, auth.session.sub)) {
    return forbidden("This application belongs to a different provider.");
  }
  const doc = providerStore.addDocument(body.applicationId, {
    type: body.type,
    title: body.title,
    version: body.version || "1.0",
    jurisdiction: body.jurisdiction || "MULTI",
    fileName: body.fileName,
    contentRef: `sandbox_ref_${Date.now().toString(36)}`,
  });
  if (!doc) return NextResponse.json({ error: "application_not_found" }, { status: 404 });
  return NextResponse.json(doc, { status: 201 });
}
