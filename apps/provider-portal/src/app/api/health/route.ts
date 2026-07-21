import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "provider-portal",
    layers: ["registration", "compliance", "open_banking", "swift", "security"],
  });
}
