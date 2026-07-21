import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: store.mandates });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    status: "active" | "paused" | "cancelled" | "failed";
    actor?: string;
  };
  const m = store.setMandateStatus(body.id, body.status, body.actor || "superadmin");
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(m);
}
