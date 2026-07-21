/**
 * EPHERA brand tokens — operational system.
 * Illuminated treatments are marketing-only; product UI uses flat tokens.
 */

/** Functional colour roles — do not glow every action */
export const brandColors = {
  /** Midnight navy — main background */
  midnight: "#050B18",
  midnightDeep: "#02060F",
  /** Deep graphite — panels / navigation */
  graphite: "#0C1526",
  graphiteElevated: "#121D32",
  /** Ice white — primary typography */
  ice: "#F4F8FF",
  iceMuted: "#8B9BB8",
  iceDim: "#5C6B86",
  /** Electric blue — voice, active, identity only */
  electric: "#3B82F6",
  electricBright: "#60A5FA",
  electricSoft: "rgba(59, 130, 246, 0.18)",
  /** Cyan — connectivity / information */
  cyan: "#22D3EE",
  /** Emerald — settled, received, verified */
  emerald: "#34D399",
  emeraldSoft: "rgba(52, 211, 153, 0.14)",
  /** Amber — attention / pending */
  amber: "#FBBF24",
  amberSoft: "rgba(251, 191, 36, 0.14)",
  /** Red — fraud, blocked, destructive */
  crimson: "#F87171",
  crimsonSoft: "rgba(248, 113, 113, 0.14)",
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(96, 165, 250, 0.35)",
  white: "#FFFFFF",
  /** Institutional flat */
  institutionalNavy: "#0B1B3A",
  institutionalInk: "#0F172A",
} as const;

export const brandTypography = {
  wordmark: {
    family: "System",
    weight: "300" as const,
    trackingEm: 0.22,
    /** Prefer ≥14px digital */
    minPx: 14,
  },
  campaignTagline: {
    family: "System",
    weight: "600" as const,
    trackingEm: 0.28,
    sizePx: 11,
  },
  corporateDescriptor: {
    family: "System",
    weight: "500" as const,
    trackingEm: 0.02,
    sizePx: 13,
  },
} as const;

/** Dual messaging — campaign vs institutional */
export const brandVoice = {
  name: "EPHERA",
  /** Consumer campaign (ads, splash, consumer app hero) */
  campaignLine: "Money without limits",
  /** Institutional / regulated materials */
  corporateDescriptor: "The voice-native financial network",
  /** Product UI default short descriptor */
  productLine: "Speak. Send. Done.",
} as const;

/** Clear space & minimum sizes (symbol height = X) */
export const brandGeometry = {
  clearSpaceX: 0.25,
  minSymbolPx: 16,
  minSymbolPxWithGlow: 48,
  minWordmarkPx: 14,
  minAppIconPx: 16,
  symbolViewBox: 96,
  /** Authoritative bar geometry (units in 96 viewBox) */
  barHeight: 14,
  barGap: 7,
  barRadius: 7,
  barFullWidth: 64,
  barMidWidth: 48,
  barInset: 16,
} as const;

export const brandArchitecture = [
  { id: "money", name: "EPHERA Money", role: "Consumer finance" },
  { id: "business", name: "EPHERA Business", role: "Merchants and small businesses" },
  { id: "connect", name: "EPHERA Connect", role: "Banks, telecoms and partners" },
  { id: "voice", name: "EPHERA Voice", role: "Voice interaction" },
  { id: "identity", name: "EPHERA Identity", role: "Credentials and verification" },
  { id: "guard", name: "EPHERA Guard", role: "Security and fraud" },
  { id: "agents", name: "EPHERA Agents", role: "Physical cash and liquidity network" },
  { id: "foundation", name: "EPHERA Foundation", role: "Inclusion and social-impact programmes" },
] as const;

/** Logo modes */
export type LogoMode =
  | "illuminated"
  | "flatWhite"
  | "flatDark"
  | "mono"
  | "highContrast";

/** Asset paths relative to packages/brand */
export const brandAssets = {
  symbolFlatWhite: "svg/symbol-flat-white.svg",
  symbolFlatDark: "svg/symbol-flat-dark.svg",
  symbolMono: "svg/symbol-mono.svg",
  symbolIlluminated: "svg/symbol-illuminated.svg",
  symbolHighContrast: "svg/symbol-high-contrast.svg",
  appIcon: "svg/app-icon.svg",
  lockupHorizontal: "svg/lockup-horizontal-white.svg",
  lockupStacked: "svg/lockup-stacked-white.svg",
  lockupInstitutional: "svg/lockup-institutional.svg",
  wordmarkOnly: "svg/wordmark-only-white.svg",
  monogram: "svg/monogram.svg",
  merchantAccepted: "svg/merchant-accepted.svg",
  verifiedBadge: "svg/verified-badge.svg",
  lottieListening: "lottie/bars-listening.json",
} as const;

/** Symbol motion states — three bars as universal language */
export type SymbolState =
  | "idle"
  | "voiceActivated"
  | "listening"
  | "processing"
  | "confirmation"
  | "paymentCompleted"
  | "securityWarning"
  | "notListening"
  | "listeningLocal"
  | "cloudProcessing"
  | "recordingConsent"
  | "micDisabled"
  | "voiceHistoryOff";

export const symbolStateCopy: Record<SymbolState, string> = {
  idle: "Inactive",
  voiceActivated: "Voice activated",
  listening: "Listening",
  processing: "Processing",
  confirmation: "Confirmed",
  paymentCompleted: "Payment completed",
  securityWarning: "Security warning",
  notListening: "Not listening",
  listeningLocal: "Listening locally",
  cloudProcessing: "Cloud processing",
  recordingConsent: "Recording with consent",
  micDisabled: "Microphone disabled",
  voiceHistoryOff: "Voice history off",
};
