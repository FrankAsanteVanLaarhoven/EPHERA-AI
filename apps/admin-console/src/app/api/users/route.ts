import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: store.users });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    status: "active" | "frozen" | "suspended" | "pending";
    actor?: string;
  };
  const u = store.setUserStatus(body.id, body.status, body.actor || "superadmin");
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Best-effort live freeze via payments API for demo user
  if (body.id === "user_demo" && (body.status === "frozen" || body.status === "active")) {
    const payments = process.env.PAYMENTS_URL || "http://localhost:8090";
    try {
      const path = body.status === "frozen" ? "/v1/wallet/freeze" : "/v1/wallet/unfreeze";
      await fetch(`${payments}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          externalRef: "user:demo-self:GHS",
          authorisationRef: "passkey_admin_console_demo",
        }),
        signal: AbortSignal.timeout(2500),
      });
    } catch {
      /* sandbox offline ok */
    }
  }

  return NextResponse.json(u);
}
