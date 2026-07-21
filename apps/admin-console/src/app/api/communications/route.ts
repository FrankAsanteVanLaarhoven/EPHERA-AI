import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = [...store.communications].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  return NextResponse.json({ items });
}
