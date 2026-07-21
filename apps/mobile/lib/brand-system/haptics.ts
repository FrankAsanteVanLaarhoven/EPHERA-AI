/**
 * EPHERA haptic identity — consistent, calm, accessibility-critical.
 * Uses expo-haptics when the native module is available; no-ops on web.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export type HapticEvent =
  | "voiceActivated"
  | "intentUnderstood"
  | "authorisationRequired"
  | "paymentCompleted"
  | "securityWarning"
  | "incomingPayment";

type Pattern = { style: "soft" | "medium" | "firm"; count: number; gapMs: number };

const PATTERNS: Record<HapticEvent, Pattern> = {
  voiceActivated: { style: "soft", count: 1, gapMs: 0 },
  intentUnderstood: { style: "soft", count: 2, gapMs: 70 },
  authorisationRequired: { style: "firm", count: 1, gapMs: 0 },
  paymentCompleted: { style: "medium", count: 3, gapMs: 90 },
  securityWarning: { style: "firm", count: 2, gapMs: 160 },
  incomingPayment: { style: "soft", count: 2, gapMs: 60 },
};

async function pulse(style: Pattern["style"]) {
  if (Platform.OS === "web") return;
  try {
    if (style === "firm") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (style === "medium") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* simulator / restricted environments — silent */
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fire brand haptic for a named event. */
export async function brandHaptic(event: HapticEvent) {
  const p = PATTERNS[event];
  for (let i = 0; i < p.count; i++) {
    await pulse(p.style);
    if (i < p.count - 1 && p.gapMs) await sleep(p.gapMs);
  }
}
