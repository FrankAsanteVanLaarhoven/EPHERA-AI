/**
 * Brand tokens mirrored for Metro (source of truth: packages/brand/src/tokens.ts).
 * Keep in sync when brand masters change.
 */

export const brandColors = {
  midnight: "#050B18",
  midnightDeep: "#02060F",
  graphite: "#0C1526",
  graphiteElevated: "#121D32",
  ice: "#F4F8FF",
  iceMuted: "#8B9BB8",
  iceDim: "#5C6B86",
  electric: "#3B82F6",
  electricBright: "#60A5FA",
  electricSoft: "rgba(59, 130, 246, 0.18)",
  cyan: "#22D3EE",
  emerald: "#34D399",
  emeraldSoft: "rgba(52, 211, 153, 0.14)",
  amber: "#FBBF24",
  amberSoft: "rgba(251, 191, 36, 0.14)",
  crimson: "#F87171",
  crimsonSoft: "rgba(248, 113, 113, 0.14)",
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(96, 165, 250, 0.35)",
  white: "#FFFFFF",
  institutionalNavy: "#0B1B3A",
  institutionalInk: "#0F172A",
} as const;

export const brandVoice = {
  name: "EPHERA",
  campaignLine: "Money without limits",
  corporateDescriptor: "The voice-native financial network",
  productLine: "Speak. Send. Done.",
} as const;

export const brandGeometry = {
  clearSpaceX: 0.25,
  minSymbolPx: 16,
  minSymbolPxWithGlow: 48,
  minWordmarkPx: 14,
  minAppIconPx: 16,
  symbolViewBox: 96,
  barHeight: 14,
  barGap: 7,
  barRadius: 7,
  barFullWidth: 64,
  barMidWidth: 48,
  barInset: 16,
} as const;

export type LogoMode =
  | "illuminated"
  | "flatWhite"
  | "flatDark"
  | "mono"
  | "highContrast";

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
