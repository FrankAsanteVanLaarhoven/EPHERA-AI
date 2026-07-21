import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: store.featureFlags });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    enabled?: boolean;
    rolloutPercent?: number;
    actor?: string;
  };
  const updated = store.setFeature(
    body.id,
    {
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.rolloutPercent === "number"
        ? { rolloutPercent: Math.max(0, Math.min(100, body.rolloutPercent)) }
        : {}),
    },
    body.actor || "superadmin",
  );
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(updated);
}
