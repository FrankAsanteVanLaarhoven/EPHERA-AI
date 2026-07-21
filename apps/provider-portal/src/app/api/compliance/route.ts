import { NextResponse } from "next/server";
import { providerStore } from "@/lib/store";
import type { ComplianceDocType, CountryCode } from "@ephera/connect-layer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
