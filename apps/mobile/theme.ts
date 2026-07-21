/**
 * Local theme mirror of the design-token package so Metro never
 * ships a stale linked-package export into the app.
 */
export const colors = {
  bg: "#050B18",
  bgDeep: "#02060F",
  surface: "#0C1526",
  surfaceElevated: "#121D32",
  surfaceGlass: "rgba(18, 32, 56, 0.72)",
  text: "#F4F8FF",
  textMuted: "#8B9BB8",
  textDim: "#5C6B86",
  accent: "#3B82F6",
  accentBright: "#60A5FA",
  accentSoft: "rgba(59, 130, 246, 0.18)",
  cyan: "#22D3EE",
  purple: "#8B5CF6",
  orbCore: "#1D4ED8",
  orbRing: "#38BDF8",
  success: "#34D399",
  danger: "#F87171",
  warning: "#FBBF24",
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(96, 165, 250, 0.35)",
  chip: "rgba(15, 23, 42, 0.85)",
  white: "#FFFFFF",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  fontFamily: "System",
  hero: 34,
  title: 28,
  subtitle: 18,
  body: 15,
  caption: 12,
  micro: 11,
} as const;
