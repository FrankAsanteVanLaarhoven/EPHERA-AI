import { NextResponse } from "next/server";
import { providerStore } from "@/lib/store";
import type { ProviderApplication } from "@ephera/connect-layer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const app = providerStore.get(id);
    if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(app);
  }
  return NextResponse.json({ items: providerStore.list() });
}

export async function POST(req: Request) {
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
  const body = (await req.json()) as {
    id: string;
    action?: "submit" | "accept_terms" | "update";
    country?: string;
    termId?: string;
    patch?: Partial<ProviderApplication>;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

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
    const app = providerStore.update(body.id, body.patch);
    if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(app);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
