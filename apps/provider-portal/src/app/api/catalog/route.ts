import { NextResponse } from "next/server";
import { COUNTRY_TERMS, REGULATORY_REQUIREMENTS, requirementsFor } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country") || undefined;
  const category = searchParams.get("category") || undefined;
  return NextResponse.json({
    requirements:
      country && category ? requirementsFor(country, category) : REGULATORY_REQUIREMENTS,
    terms: COUNTRY_TERMS,
    categories: [
      "mobile_money",
      "bank",
      "merchant",
      "utility",
      "telecom",
      "open_banking",
      "card_acquirer",
      "fx",
      "swift_correspondent",
      "fintech",
    ],
    countries: ["GH", "NG", "KE", "ZA", "RW", "CI", "SN", "MULTI"],
  });
}
