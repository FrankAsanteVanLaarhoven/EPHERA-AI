/** Shared design tokens — not full UI components. */
export const colors = {
  bg: "#0B0F14",
  surface: "#121821",
  surfaceElevated: "#1A2230",
  text: "#F4F7FB",
  textMuted: "#9AA8BC",
  accent: "#4C8DFF",
  accentSoft: "#1E3A5F",
  success: "#2FBF71",
  danger: "#F04343",
  warning: "#F5A524",
  border: "#243041",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  fontFamily: "System",
  title: 28,
  body: 16,
  caption: 13,
} as const;
