/**
 * Neo-halo mood system — HUD chrome lighting (separate from logo colours).
 * Default tube: crispy neon white. Client can pick any RGB.
 */

export type MoodId =
  | "tube"
  | "electric"
  | "cyan"
  | "emerald"
  | "amber"
  | "gold"
  | "orange"
  | "lime"
  | "teal"
  | "magenta"
  | "violet"
  | "crimson"
  | "rose"
  | "steel"
  | "ice"
  | "custom";

export type MoodSpec = {
  id: MoodId;
  label: string;
  tube: string;
  tubeSoft: string;
  halo: string;
  edge: string;
  textGlow: string;
};

function makeMood(
  id: Exclude<MoodId, "custom">,
  label: string,
  tube: string,
  halo?: string,
): MoodSpec {
  const rgb = hexToRgb(tube) ?? { r: 244, g: 248, b: 255 };
  const h = halo ?? tube;
  return {
    id,
    label,
    tube,
    tubeSoft: `rgba(${rgb.r},${rgb.g},${rgb.b},0.16)`,
    halo: h,
    edge: `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`,
    textGlow: tube,
  };
}

export const MOODS: Record<Exclude<MoodId, "custom">, MoodSpec> = {
  tube: makeMood("tube", "Neon white", "#F4F8FF", "#E8F1FF"),
  ice: makeMood("ice", "Ice", "#E0F2FE", "#BAE6FD"),
  electric: makeMood("electric", "Electric blue", "#60A5FA", "#3B82F6"),
  cyan: makeMood("cyan", "Mission cyan", "#22D3EE", "#06B6D4"),
  teal: makeMood("teal", "Teal", "#2DD4BF", "#14B8A6"),
  emerald: makeMood("emerald", "Emerald", "#34D399", "#10B981"),
  lime: makeMood("lime", "Lime", "#A3E635", "#84CC16"),
  amber: makeMood("amber", "Amber", "#FBBF24", "#F59E0B"),
  gold: makeMood("gold", "Gold", "#F5D76E", "#EAB308"),
  orange: makeMood("orange", "Orange", "#FB923C", "#F97316"),
  rose: makeMood("rose", "Rose", "#FB7185", "#F43F5E"),
  crimson: makeMood("crimson", "Crimson", "#F87171", "#EF4444"),
  magenta: makeMood("magenta", "Magenta", "#E879F9", "#D946EF"),
  violet: makeMood("violet", "Violet", "#A78BFA", "#8B5CF6"),
  steel: makeMood("steel", "Steel", "#94A3B8", "#64748B"),
};

/** Ordered list for UI chips */
export const MOOD_LIST = Object.values(MOODS);

export function moodFromRgb(r: number, g: number, b: number): MoodSpec {
  const tube = rgbToHex(r, g, b);
  return {
    id: "custom",
    label: "Custom",
    tube,
    tubeSoft: `rgba(${r},${g},${b},0.16)`,
    halo: tube,
    edge: `rgba(${r},${g},${b},0.55)`,
    textGlow: tube,
  };
}

export function moodFromHex(hex: string): MoodSpec {
  const rgb = hexToRgb(hex);
  if (!rgb) return MOODS.tube;
  return moodFromRgb(rgb.r, rgb.g, rgb.b);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function normalizeHex(input: string): string | null {
  const t = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t.toUpperCase()}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    const s = t.slice(1);
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toUpperCase();
  }
  return null;
}

/** HSV 0–1 → hex */
export function hsvToHex(h: number, s: number, v: number): string {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return rgbToHex(r * 255, g * 255, b * 255);
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const rgb = hexToRgb(hex) ?? { r: 244, g: 248, b: 255 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
