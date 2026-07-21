import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../lib/theme-context";
import { Icon, type IconName } from "./Icon";

type Tone = "tube" | "accent" | "success" | "warning" | "danger" | "cyan" | "muted";

/**
 * HUD icon cell — frosted glass + neo-halo edge.
 * Minority Report / Iron Man control-panel affordance.
 */
export function IconWell({
  name,
  size = 42,
  iconSize,
  tone = "tube",
  rounded = 12,
}: {
  name: IconName;
  size?: number;
  iconSize?: number;
  tone?: Tone;
  rounded?: number;
}) {
  const { mood, colors, isDark } = useTheme();
  const glyph = iconSize ?? Math.round(size * 0.42);

  const tube =
    tone === "tube"
      ? mood.tube
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
                : colors.textMuted;

  const fillA = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.72)";
  const fillB = isDark ? "rgba(8,14,28,0.45)" : "rgba(241,245,249,0.55)";

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: "hidden",
        shadowColor: tube,
        shadowOpacity: isDark ? 0.35 : 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <LinearGradient
        colors={[fillA, fillB]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: rounded,
          borderWidth: StyleSheet.hairlineWidth * 1.5,
          borderColor: `${tube}66`,
        }}
      >
        {/* top specular */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 1,
            left: 6,
            right: 6,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.45)",
            borderRadius: 1,
            opacity: 0.75,
          }}
        />
        <Icon name={name} size={glyph} color={tube} strokeWidth={1.7} />
      </LinearGradient>
    </View>
  );
}
