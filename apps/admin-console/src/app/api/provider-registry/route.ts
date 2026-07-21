import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PORTAL = process.env.PROVIDER_PORTAL_URL || "http://localhost:3008";

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

export async function PATCH(req: Request) {
  const body = await req.json();
  try {
    const r = await fetch(`${PORTAL}/api/admin`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const json = await r.json();
    return NextResponse.json(json, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "portal_unreachable" },
      { status: 502 },
    );
  }
}
