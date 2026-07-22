import { NextResponse } from "next/server";
import { providerStore } from "@/lib/store";
import { forbidden, sessionFromRequest, unauthorised } from "@/lib/session";
import type { ProviderApplication } from "@ephera/connect-layer";

export const dynamic = "force-dynamic";

/**
 * Reads are scoped to the authenticated provider.
 *
 * This endpoint used to return every application -- legal names, registration
 * numbers, tax IDs, contact details and compliance documents -- to any caller,
 * and `?id=` fetched any record by guessable id (D-08).
 */
export async function GET(req: Request) {
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const app = providerStore.ownedBy(id, auth.session.sub);
    // Not-found and not-yours are the same answer, so the endpoint cannot be
    // used to discover which application ids exist.
    if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(app);
  }
  return NextResponse.json({ items: providerStore.listForOwner(auth.session.sub) });
}

export async function POST(req: Request) {
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const body = (await req.json()) as Partial<ProviderApplication> & {
    legalName: string;
    tradingName: string;
    category: ProviderApplication["category"];
    primaryCountry: string;
    contactEmail: string;
    contactName: string;
  };

  if (!body.legalName || !body.category || !body.primaryCountry || !body.contactEmail) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const app = providerStore.create({
    legalName: body.legalName,
    tradingName: body.tradingName || body.legalName,
    category: body.category,
    countries: body.countries || [body.primaryCountry],
    primaryCountry: body.primaryCountry,
    registrationNumber: body.registrationNumber || "",
    taxId: body.taxId || "",
    website: body.website,
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone || "",
    servicesOffered: body.servicesOffered || [],
    description: body.description || "",
    security: body.security || {
      wantsOpenBanking: false,
      wantsSwift: false,
      mtlsReady: false,
      ipAllowlist: [],
    },
  });

  return NextResponse.json(app, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = sessionFromRequest(req);
  if (!auth.ok) return unauthorised(auth.reason);

  const body = (await req.json()) as {
    id: string;
    action?: "submit" | "accept_terms" | "update";
    country?: string;
    termId?: string;
    patch?: Partial<ProviderApplication>;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!providerStore.ownedBy(body.id, auth.session.sub)) {
    // A provider could previously patch any application by id, including
    // another provider's (D-09).
    return forbidden("This application belongs to a different provider.");
  }

  if (body.action === "submit") {
    const app = providerStore.submit(body.id);
    if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(app);
  }
  if (body.action === "accept_terms" && body.country && body.termId) {
    const app = providerStore.acceptTerms(body.id, body.country, body.termId);
    if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(app);
  }
  if (body.patch) {
    // Only fields an applicant owns may be patched. The previous version
    // blind-merged whatever was sent, so an applicant could set its own
    // `status` to "approved", rewrite its own compliance documents, or edit
    // another provider's record entirely (D-09).
    const allowed = [
      "legalName", "tradingName", "category", "countries", "primaryCountry",
      "registrationNumber", "taxId", "website", "contactName", "contactEmail",
      "contactPhone", "servicesOffered", "webhookUrl", "ipAllowlist", "mtlsReady",
    ] as const;
    const patch: Partial<ProviderApplication> = {};
    const rejected: string[] = [];
    for (const [k, v] of Object.entries(body.patch)) {
      if ((allowed as readonly string[]).includes(k)) {
        (patch as Record<string, unknown>)[k] = v;
      } else {
        rejected.push(k);
      }
    }
    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: "field_not_editable",
          message:
            "These fields are not applicant-editable. Status changes require an " +
            "approved control-plane change with a second operator.",
          fields: rejected,
        },
        { status: 403 },
      );
    }
    const app = providerStore.update(body.id, patch);
    if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(app);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
