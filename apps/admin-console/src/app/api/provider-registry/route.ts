import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PORTAL = process.env.PROVIDER_PORTAL_URL || "http://localhost:3008";

// Mutating routes were removed at G2-C.
//
// This console had no server-side authentication on any route, took the acting
// identity from the request body defaulting to "superadmin", and enforced its
// role model on one route in nineteen (D-06, D-07, D-12). Two of its routes
// reached the money path using a hardcoded authorisation literal.
//
// State-changing operations now belong to platform-control-bff, where they are
// authenticated from a signed operator session, permissioned server-side,
// require a second operator, and are written to an append-only hash-chained
// audit log. Until this console is rebuilt against that service it is
// read-only: removing the routes removes the exposure, rather than leaving it
// in place behind a promise.

export async function GET() {
  try {
    const r = await fetch(`${PORTAL}/api/admin`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const body = await r.json();
    return NextResponse.json({
      connected: r.ok,
      portalUrl: PORTAL,
      ...body,
    });
  } catch (e) {
    return NextResponse.json({
      connected: false,
      portalUrl: PORTAL,
      items: [],
      summary: null,
      error: e instanceof Error ? e.message : "portal_unreachable",
    });
  }
}
