import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MOODS,
  moodFromHex,
  normalizeHex,
  type MoodId,
  type MoodSpec,
} from "./mood";
import { DEFAULT_LOGO_STYLE, type LogoStyle } from "./logo-style";

const STORAGE_KEY = "@ephera/theme-mode/v1";
const MOOD_KEY = "@ephera/mood/v1";
const CUSTOM_RGB_KEY = "@ephera/mood-custom-rgb/v1";
const LOGO_KEY = "@ephera/logo-style/v1";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export type AppColors = {
  bg: string;
  bgDeep: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentBright: string;
  accentSoft: string;
  cyan: string;
  purple: string;
  success: string;
  danger: string;
  warning: string;
  border: string;
  borderStrong: string;
  chip: string;
  white: string;
  glass: string;
  glassBorder: string;
  card: string;
  invert: string;
  neon: string;
  institutionalNavy: string;
};

const darkColors: AppColors = {
  bg: "#03060F",
  bgDeep: "#010309",
  surface: "#0A1220",
  surfaceElevated: "#0F1A2E",
  surfaceGlass: "rgba(10, 18, 36, 0.42)",
  text: "#F4F8FF",
  textMuted: "#9AABC6",
  textDim: "#5E6F8C",
  accent: "#3B82F6",
  accentBright: "#7DB4FF",
  accentSoft: "rgba(59, 130, 246, 0.16)",
  cyan: "#22D3EE",
  purple: "#C084FC",
  success: "#34D399",
  danger: "#F87171",
  warning: "#FBBF24",
  border: "rgba(244, 248, 255, 0.10)",
  borderStrong: "rgba(244, 248, 255, 0.28)",
  chip: "rgba(8, 14, 28, 0.75)",
  white: "#FFFFFF",
  glass: "rgba(12, 20, 40, 0.38)",
  glassBorder: "rgba(244, 248, 255, 0.16)",
  card: "rgba(8, 14, 28, 0.48)",
  invert: "#0B1220",
  neon: "#F4F8FF",
  institutionalNavy: "#0B1B3A",
};

const lightColors: AppColors = {
  bg: "#E8EEF6",
  bgDeep: "#D9E2F0",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceGlass: "rgba(255, 255, 255, 0.62)",
  text: "#0B1220",
  textMuted: "#4B5B74",
  textDim: "#7A8BA3",
  accent: "#2563EB",
  accentBright: "#1D4ED8",
  accentSoft: "rgba(37, 99, 235, 0.12)",
  cyan: "#0891B2",
  purple: "#7C3AED",
  success: "#059669",
  danger: "#DC2626",
  warning: "#D97706",
  border: "rgba(15, 23, 42, 0.1)",
  borderStrong: "rgba(37, 99, 235, 0.28)",
  chip: "rgba(241, 245, 249, 0.88)",
  white: "#FFFFFF",
  glass: "rgba(255, 255, 255, 0.55)",
  glassBorder: "rgba(15, 23, 42, 0.1)",
  card: "rgba(255, 255, 255, 0.72)",
  invert: "#F4F8FF",
  neon: "#0B1B3A",
  institutionalNavy: "#0B1B3A",
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  colors: AppColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  /** HUD chrome mood (edges, icons, glass halo) — NOT logo */
  mood: MoodSpec;
  moodId: MoodId;
  setMoodId: (id: MoodId) => Promise<void>;
  setCustomRgb: (hex: string) => Promise<void>;
  customHex: string;
  /** Logo-only colours */
  logo: LogoStyle;
  setLogoTube: (hex: string) => Promise<void>;
  setLogoBg: (hex: string) => Promise<void>;
  setLogoBgEnabled: (on: boolean) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [moodId, setMoodIdState] = useState<MoodId>("tube");
  const [customHex, setCustomHex] = useState("#F4F8FF");
  const [logo, setLogoState] = useState<LogoStyle>(DEFAULT_LOGO_STYLE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [raw, m, rgb, logoRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(MOOD_KEY),
          AsyncStorage.getItem(CUSTOM_RGB_KEY),
          AsyncStorage.getItem(LOGO_KEY),
        ]);
        if (!cancelled) {
          if (raw === "light" || raw === "dark" || raw === "system") setModeState(raw);
          if (m && (m in MOODS || m === "custom")) setMoodIdState(m as MoodId);
          if (rgb) setCustomHex(rgb);
          if (logoRaw) {
            const parsed = JSON.parse(logoRaw) as Partial<LogoStyle>;
            setLogoState({ ...DEFAULT_LOGO_STYLE, ...parsed });
          }
        }
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved: ResolvedTheme =
    mode === "system" ? (system === "light" ? "light" : "dark") : mode;

  const colors = resolved === "light" ? lightColors : darkColors;

  const mood: MoodSpec = useMemo(() => {
    if (moodId === "custom") return moodFromHex(customHex);
    return MOODS[moodId as Exclude<MoodId, "custom">] ?? MOODS.tube;
  }, [moodId, customHex]);

  const persistLogo = useCallback(async (next: LogoStyle) => {
    try {
      await AsyncStorage.setItem(LOGO_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setMoodId = useCallback(async (id: MoodId) => {
    setMoodIdState(id);
    try {
      await AsyncStorage.setItem(MOOD_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const setCustomRgb = useCallback(async (hex: string) => {
    const n = normalizeHex(hex) ?? hex;
    setCustomHex(n);
    setMoodIdState("custom");
    try {
      await AsyncStorage.setItem(CUSTOM_RGB_KEY, n);
      await AsyncStorage.setItem(MOOD_KEY, "custom");
    } catch {
      /* ignore */
    }
  }, []);

  const setLogoTube = useCallback(
    async (hex: string) => {
      const n = normalizeHex(hex) ?? hex;
      const next = { ...logo, tube: n };
      setLogoState(next);
      await persistLogo(next);
    },
    [logo, persistLogo],
  );

  const setLogoBg = useCallback(
    async (hex: string) => {
      const n = normalizeHex(hex) ?? hex;
      const next = { ...logo, bg: n };
      setLogoState(next);
      await persistLogo(next);
    },
    [logo, persistLogo],
  );

  const setLogoBgEnabled = useCallback(
    async (on: boolean) => {
      const next = { ...logo, bgEnabled: on };
      setLogoState(next);
      await persistLogo(next);
    },
    [logo, persistLogo],
  );

  const value = useMemo(
    () => ({
      mode,
      resolved,
      colors,
      isDark: resolved === "dark",
      setMode,
      mood,
      moodId,
      setMoodId,
      setCustomRgb,
      customHex,
      logo,
      setLogoTube,
      setLogoBg,
      setLogoBgEnabled,
    }),
    [
      mode,
      resolved,
      colors,
      setMode,
      mood,
      moodId,
      setMoodId,
      setCustomRgb,
      customHex,
      logo,
      setLogoTube,
      setLogoBg,
      setLogoBgEnabled,
    ],
  );

  void ready;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export { darkColors, lightColors };
