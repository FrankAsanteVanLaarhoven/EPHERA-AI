import { NextResponse } from "next/server";
import { probeLive } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const live = await probeLive();
  return NextResponse.json({ status: "ok", service: "admin-console", live });
}
