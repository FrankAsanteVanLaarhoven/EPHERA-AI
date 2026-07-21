/**
 * Logo colours — independent of HUD mood.
 * tube: neon light of the mark
 * bg: optional plate behind the mark
 */

export type LogoStyle = {
  /** Neon / tube light colour of the logo silhouette */
  tube: string;
  /** Plate / disc behind the logo */
  bg: string;
  /** Whether to show the plate */
  bgEnabled: boolean;
};

export const DEFAULT_LOGO_STYLE: LogoStyle = {
  tube: "#F4F8FF",
  bg: "#050B18",
  bgEnabled: false,
};

export const LOGO_BG_PRESETS = [
  "#050B18",
  "#000000",
  "#0B1B3A",
  "#111827",
  "#1E293B",
  "#FFFFFF",
  "#0F172A",
  "#164E63",
  "#14532D",
  "#4C1D95",
] as const;
