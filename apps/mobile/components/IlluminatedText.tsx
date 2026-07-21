import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTheme } from "../lib/theme-context";

type Tone =
  | "tube"
  | "muted"
  | "dim"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "cyan"
  | "inherit";

/**
 * Backlit / tube-illuminated type for HUD surfaces.
 * Uses textShadow as soft neon backlight (RN limitation vs CSS glow).
 */
export function IlluminatedText({
  children,
  tone = "tube",
  glow = true,
  style,
  numberOfLines,
  adjustsFontSizeToFit,
}: {
  children: React.ReactNode;
  tone?: Tone;
  glow?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}) {
  const { colors, mood, isDark } = useTheme();

  const color =
    tone === "tube"
      ? mood.textGlow
      : tone === "muted"
        ? colors.textMuted
        : tone === "dim"
          ? colors.textDim
          : tone === "accent"
            ? colors.accentBright
            : tone === "success"
              ? colors.success
              : tone === "warning"
                ? colors.warning
                : tone === "danger"
                  ? colors.danger
                  : tone === "cyan"
                    ? colors.cyan
                    : colors.text;

  const shadow =
    glow && isDark && tone !== "dim" && tone !== "muted"
      ? {
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: tone === "tube" ? 10 : 8,
        }
      : {};

  return (
    <Text
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      style={[{ color, ...shadow }, style]}
    >
      {children}
    </Text>
  );
}
