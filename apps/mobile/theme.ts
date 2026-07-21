/**
 * EPHERA visual system — product chrome.
 * Colour roles must stay aligned with packages/brand/src/tokens.ts (brandColors).
 * Electric blue is reserved for voice / active / identity — not every CTA.
 * Typography: light wordmark, open tracking, calm body (credible for banks).
 */
export const colors = {
  /** Midnight navy */
  bg: "#050B18",
  bgDeep: "#02060F",
  /** Deep graphite */
  surface: "#0C1526",
  surfaceElevated: "#121D32",
  surfaceGlass: "rgba(18, 32, 56, 0.72)",
  /** Ice white */
  text: "#F4F8FF",
  textMuted: "#8B9BB8",
  textDim: "#5C6B86",
  /** Electric blue — voice / active / identity only */
  accent: "#3B82F6",
  accentBright: "#60A5FA",
  accentSoft: "rgba(59, 130, 246, 0.18)",
  /** Cyan — connectivity / info */
  cyan: "#22D3EE",
  purple: "#8B5CF6",
  orbCore: "#1D4ED8",
  orbRing: "#38BDF8",
  /** Emerald — settled / verified */
  success: "#34D399",
  /** Crimson — fraud / block */
  danger: "#F87171",
  /** Amber — pending / attention */
  warning: "#FBBF24",
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(96, 165, 250, 0.35)",
  chip: "rgba(15, 23, 42, 0.85)",
  white: "#FFFFFF",
  /** Institutional flat navy */
  institutionalNavy: "#0B1B3A",
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

/**
 * Brand type scale — consistent with original dashboard / splash.
 * Use fontWeight 200 for wordmarks, 600–700 for UI, never heavy display except balance.
 */
export const typography = {
  fontFamily: "System",
  /** Splash hero wordmark */
  brand: 40,
  brandTrack: 10,
  /** Dashboard / header wordmark */
  brandSm: 14,
  brandSmTrack: 3.5,
  /** Tagline under logo */
  tagline: 10,
  taglineTrack: 4.5,
  /** Large balance figure (home) */
  hero: 34,
  /** Screen titles (Payments, Money, …) */
  title: 26,
  titleTrack: -0.4,
  /** Splash supporting line */
  subtitle: 18,
  /** Section headers */
  section: 15,
  /** Body / list primary */
  body: 14,
  /** Secondary / meta */
  caption: 12,
  /** Micro labels / kickers */
  micro: 11,
  microTrack: 0.6,
} as const;

export const type = {
  wordmark: {
    fontFamily: "System" as const,
    fontWeight: "200" as const,
    letterSpacing: typography.brandTrack,
  },
  wordmarkSm: {
    fontFamily: "System" as const,
    fontWeight: "200" as const,
    letterSpacing: typography.brandSmTrack,
  },
  tagline: {
    fontFamily: "System" as const,
    fontWeight: "600" as const,
    fontSize: typography.tagline,
    letterSpacing: typography.taglineTrack,
    textTransform: "uppercase" as const,
  },
  screenTitle: {
    fontFamily: "System" as const,
    fontWeight: "700" as const,
    fontSize: typography.title,
    letterSpacing: typography.titleTrack,
  },
  balance: {
    fontFamily: "System" as const,
    fontWeight: "700" as const,
    fontSize: typography.hero,
    letterSpacing: -0.8,
  },
  kicker: {
    fontFamily: "System" as const,
    fontWeight: "800" as const,
    fontSize: typography.micro,
    letterSpacing: typography.microTrack,
    textTransform: "uppercase" as const,
  },
  body: {
    fontFamily: "System" as const,
    fontWeight: "500" as const,
    fontSize: typography.body,
  },
  bodyStrong: {
    fontFamily: "System" as const,
    fontWeight: "700" as const,
    fontSize: typography.body,
  },
  caption: {
    fontFamily: "System" as const,
    fontWeight: "500" as const,
    fontSize: typography.caption,
  },
} as const;

export const shadows = {
  orb: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 12,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
