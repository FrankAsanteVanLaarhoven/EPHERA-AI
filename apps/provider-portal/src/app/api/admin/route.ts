import { NextResponse } from "next/server";
import { providerStore } from "@/lib/store";
import type { ComplianceDocument, ProviderApplication } from "@ephera/connect-layer";

export const dynamic = "force-dynamic";

/**
 * Super Admin facing API (sandbox).
 * In production: mTLS + SSO + network policy — never public.
 */
export async function GET() {
  const items = providerStore.list();
  return NextResponse.json({
    items,
    summary: {
      total: items.length,
      byStatus: items.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      openBankingOptIn: items.filter((a) => a.security.wantsOpenBanking).length,
      swiftOptIn: items.filter((a) => a.security.wantsSwift).length,
      pendingDocs: items.reduce(
        (n, a) => n + a.documents.filter((d) => d.status === "submitted" || d.status === "under_review").length,
        0,
      ),
    },
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    action: "set_status" | "review_doc";
    applicationId: string;
    status?: ProviderApplication["status"];
    note?: string;
    documentId?: string;
    docStatus?: ComplianceDocument["status"];
  };

  if (body.action === "set_status" && body.status) {
    const result = providerStore.setAdminStatus(
      body.applicationId,
      body.status,
      body.note || `Status → ${body.status}`,
    );
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(result);
  }

  if (body.action === "review_doc" && body.documentId && body.docStatus) {
    const doc = providerStore.reviewDocument(
      body.applicationId,
      body.documentId,
      body.docStatus,
      body.note,
    );
    if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(doc);
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
