import { Pressable, View, type ViewStyle } from "react-native";
import { useTheme } from "../lib/theme-context";
import { NeonLogo, type LogoIntensity } from "./brand/NeonLogo";

type MarkProps = {
  size?: number;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: "neon" | "ui" | "darkMetal" | "tube" | "metal" | "crisp";
};

/**
 * Official monogram — crisp by default for UI chrome (always readable).
 */
export function EpheraMark({
  size = 36,
  onPress,
  style,
  variant = "crisp",
}: MarkProps) {
  const intensity: LogoIntensity =
    variant === "metal" || variant === "darkMetal"
      ? "metal"
      : variant === "tube"
        ? "tube"
        : "crisp";

  const body = (
    <View style={[{ backgroundColor: "transparent" }, style]}>
      <NeonLogo size={size} layout="symbol" intensity={intensity} />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Ephera"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

type LogoProps = {
  onPress?: () => void;
  markSize?: number;
  showWord?: boolean;
  variant?: "compact" | "horizontal" | "horizontalDark" | "darkMetal" | "neon" | "crisp";
  height?: number;
};

/**
 * Header lockup — crisp horizontal master so the logo is always sharp.
 */
export function EpheraLogo({
  onPress,
  markSize = 34,
  showWord = false,
  variant = "crisp",
  height = 28,
}: LogoProps) {
  let body: React.ReactNode;

  if (variant === "darkMetal" || variant === "horizontalDark") {
    body = (
      <NeonLogo size={height * 1.05} layout="horizontal" intensity="metal" />
    );
  } else if (showWord || variant === "horizontal" || variant === "neon" || variant === "crisp") {
    // Prefer horizontal lockup in headers (matches product brand image)
    body = (
      <NeonLogo
        size={Math.max(markSize * 0.72, height)}
        layout={showWord || variant === "horizontal" || variant === "neon" ? "horizontal" : "symbol"}
        intensity="crisp"
      />
    );
  } else {
    body = <NeonLogo size={markSize} layout="symbol" intensity="crisp" />;
  }

  // Always use horizontal when showWord
  if (showWord) {
    body = (
      <NeonLogo
        size={Math.max(26, height)}
        layout="horizontal"
        intensity="crisp"
      />
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Ephera"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        {body}
      </Pressable>
    );
  }
  return <>{body}</>;
}

export function EpheraStackedLogo({
  height = 220,
  variant = "tube",
}: {
  height?: number;
  variant?: "glow" | "print" | "metal" | "darkMetal" | "neon" | "tube" | "crisp";
}) {
  const intensity: LogoIntensity =
    variant === "metal" || variant === "darkMetal" || variant === "print"
      ? "metal"
      : variant === "crisp"
        ? "crisp"
        : "tube";
  const size = height / 1.55;
  return (
    <NeonLogo
      size={size}
      layout="stacked"
      intensity={intensity}
      pulse={intensity === "tube"}
    />
  );
}

export function EpheraAppIcon({ size = 72 }: { size?: number }) {
  const { logo } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        backgroundColor: logo.bgEnabled ? logo.bg : "#050B18",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        shadowColor: logo.tube,
        shadowOpacity: 0.55,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <NeonLogo size={size * 0.58} layout="symbol" intensity="crisp" plate={false} />
    </View>
  );
}

export function EpheraWordmark({
  size = "md",
  style,
  metal = false,
}: {
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
  metal?: boolean;
}) {
  const h = size === "lg" ? 34 : size === "sm" ? 22 : 28;
  return (
    <View style={[{ backgroundColor: "transparent" }, style]}>
      <NeonLogo
        size={h}
        layout="horizontal"
        intensity={metal ? "metal" : "crisp"}
      />
    </View>
  );
}
