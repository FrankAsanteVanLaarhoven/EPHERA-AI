import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: store.providers });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    status: "online" | "degraded" | "offline" | "sandbox";
    actor?: string;
  };
  const p = store.setProviderStatus(body.id, body.status, body.actor || "superadmin");
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(p);
}
