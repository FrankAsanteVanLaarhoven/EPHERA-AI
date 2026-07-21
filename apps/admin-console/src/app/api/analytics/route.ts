import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const byCurrency = store.regions.reduce<Record<string, { tx: number; volume: number; failed: number }>>(
    (acc, r) => {
      if (!acc[r.currency]) acc[r.currency] = { tx: 0, volume: 0, failed: 0 };
      acc[r.currency].tx += r.txCount;
      acc[r.currency].volume += r.volumeMinor;
      acc[r.currency].failed += r.failedCount;
      return acc;
    },
    {},
  );

  const channelMix = store.communications.reduce<Record<string, number>>((acc, c) => {
    acc[c.channel] = (acc[c.channel] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    devices: store.devices,
    regions: store.regions,
    byCurrency,
    channelMix,
    hourlyVolume: [42, 38, 55, 70, 88, 120, 140, 160, 155, 148, 130, 110, 95, 100, 125, 150, 170, 165, 140, 120, 90, 75, 60, 50],
  });
}
