/**
 * EPHERA sonic identity — three-note system (mirrors three bars).
 *
 * 1 · Intent received
 * 2 · Identity verified
 * 3 · Action completed
 *
 * Full WAV/CAF masters belong in brand production. This module documents
 * the cue map and provides a lightweight Web Audio fallback for demos.
 */

export type SonicCue =
  | "listening"
  | "intentReceived"
  | "identityVerified"
  | "actionCompleted"
  | "success"
  | "warning"
  | "failed"
  | "incoming"
  | "secureAuth";

/** Relative pitch steps (Hz) for three-note motif — calm, mid register */
export const THREE_NOTE = [523.25, 659.25, 783.99] as const; // C5 E5 G5

const CUE_MAP: Record<SonicCue, { notes: number[]; durations: number[] }> = {
  listening: { notes: [THREE_NOTE[0]], durations: [0.12] },
  intentReceived: { notes: [THREE_NOTE[0]], durations: [0.1] },
  identityVerified: { notes: [THREE_NOTE[0], THREE_NOTE[1]], durations: [0.08, 0.1] },
  actionCompleted: {
    notes: [...THREE_NOTE],
    durations: [0.08, 0.08, 0.12],
  },
  success: { notes: [...THREE_NOTE], durations: [0.07, 0.07, 0.14] },
  warning: { notes: [440, 440], durations: [0.1, 0.14] },
  failed: { notes: [392, 330], durations: [0.12, 0.16] },
  incoming: { notes: [THREE_NOTE[1], THREE_NOTE[0]], durations: [0.09, 0.1] },
  secureAuth: { notes: [THREE_NOTE[2]], durations: [0.18] },
};

/** Soft demo beep via Web Audio if available (no asset files required). */
let brandSonicEnabled = true;

export function setBrandSonicEnabled(on: boolean) {
  brandSonicEnabled = on;
}

export async function brandSonic(cue: SonicCue) {
  if (!brandSonicEnabled) return;
  try {
    // @ts-expect-error optional web audio in RN web
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const map = CUE_MAP[cue];
    let t = ctx.currentTime + 0.02;
    map.notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + map.durations[i]);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + map.durations[i] + 0.02);
      t += map.durations[i] + 0.04;
    });
  } catch {
    /* silent when audio unavailable */
  }
}
