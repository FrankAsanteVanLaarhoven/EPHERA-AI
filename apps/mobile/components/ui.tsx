import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { radii, space, typography } from "../theme";
import { useTheme } from "../lib/theme-context";
import { tacticalClick, type TacticalClick } from "../lib/tactical-clicks";
import { Icon, type IconName } from "./icons/Icon";
import { IconWell } from "./icons/IconWell";
import { IlluminatedText } from "./IlluminatedText";

/**
 * Control-panel chrome — glassmorphism + neo-halo.
 * Aesthetic: Mission Impossible · Iron Man HUD · NASA · Minority Report.
 * Default tube: crispy neon white (mood system).
 */

export function Screen({
  children,
  style,
  edges = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: boolean;
}) {
  const { colors, isDark, mood } = useTheme();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg },
        edges && {
          paddingHorizontal: space.lg,
          paddingTop: 56,
          paddingBottom: space.lg,
        },
        style,
      ]}
    >
      {/* Ambient depth wash */}
      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? ["rgba(4,10,24,1)", "rgba(2,5,12,1)", "rgba(1,2,6,1)"]
            : ["rgba(232,238,246,1)", "rgba(243,246,251,1)", "rgba(232,238,246,1)"]
        }
        style={StyleSheet.absoluteFill}
      />
      {/* Soft mood bloom top */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${mood.halo}18`, "transparent", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/**
 * Translucent glass panel with neo-halo rim.
 * Prefer this for every card / widget / modal surface.
 */
export function GlassCard({
  children,
  style,
  halo = true,
  intensity = "default",
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  halo?: boolean;
  intensity?: "default" | "strong" | "subtle";
}) {
  const { isDark, mood } = useTheme();
  const alpha =
    intensity === "strong" ? 0.52 : intensity === "subtle" ? 0.28 : 0.38;

  return (
    <View
      style={[
        {
          borderRadius: radii.lg,
          overflow: "hidden",
          shadowColor: halo ? mood.halo : "#000",
          shadowOpacity: isDark && halo ? 0.22 : 0.08,
          shadowRadius: halo ? 16 : 8,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? [
                `rgba(255,255,255,${0.1})`,
                `rgba(18,28,52,${alpha})`,
                `rgba(6,12,24,${alpha + 0.08})`,
              ]
            : [
                "rgba(255,255,255,0.82)",
                "rgba(255,255,255,0.48)",
                "rgba(241,245,249,0.55)",
              ]
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth * 1.5,
          borderColor: isDark ? mood.edge : "rgba(15,23,42,0.1)",
          padding: space.md,
          overflow: "hidden",
        }}
      >
        {/* Specular top edge */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 12,
            right: 12,
            height: 1,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.42)"
              : "rgba(255,255,255,0.95)",
            opacity: 0.85,
          }}
        />
        {/* Soft inner mood wash */}
        {halo ? (
          <LinearGradient
            pointerEvents="none"
            colors={[`${mood.halo}10`, "transparent"]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {children}
      </LinearGradient>
    </View>
  );
}

/** Modal shell — elevated glass with stronger halo */
export function GlassModal({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassCard intensity="strong" style={[{ borderRadius: radii.xl }, style]}>
      {children}
    </GlassCard>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "tube";
type BtnSize = "sm" | "md" | "lg";

const SIZE = {
  sm: { minH: 36, padH: 12, font: 13, icon: 13, radius: 18, gap: 5 },
  md: { minH: 44, padH: 16, font: 14, icon: 14, radius: 22, gap: 6 },
  lg: { minH: 48, padH: 18, font: 15, icon: 15, radius: 24, gap: 7 },
} as const;

export function PrimaryButton({
  label,
  onPress,
  icon,
  iconName,
  variant = "primary",
  disabled,
  size = "md",
  style,
  click = "ui_tap",
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  iconName?: IconName;
  variant?: BtnVariant;
  disabled?: boolean;
  size?: BtnSize;
  style?: StyleProp<ViewStyle>;
  /** Military keyboard click variant */
  click?: TacticalClick | false;
}) {
  const { colors, isDark, mood } = useTheme();
  const s = SIZE[size];
  const glass = glassForVariant(variant, isDark, colors, mood.tube, mood.edge);

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (click) void tacticalClick(click);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          minHeight: s.minH,
          borderRadius: s.radius,
          overflow: "hidden",
          opacity: disabled ? 0.4 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
          shadowColor: variant === "tube" || variant === "primary" ? mood.halo : "#000",
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
        },
        style,
      ]}
    >
      <LinearGradient
        colors={glass.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          minHeight: s.minH,
          paddingHorizontal: s.padH,
          borderRadius: s.radius,
          borderWidth: StyleSheet.hairlineWidth * 1.5,
          borderColor: glass.border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: s.gap,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 8,
            right: 8,
            height: 1,
            backgroundColor: glass.sheen,
            borderRadius: 1,
            opacity: 0.75,
          }}
        />
        {iconName ? (
          <Icon name={iconName} size={s.icon + 2} color={glass.text} strokeWidth={1.7} />
        ) : icon ? (
          <Text style={{ fontSize: s.icon, color: glass.text, opacity: 0.95 }}>
            {icon}
          </Text>
        ) : null}
        <Text
          style={{
            color: glass.text,
            fontSize: s.font,
            fontWeight: "600",
            letterSpacing: 0.2,
            textShadowColor: isDark ? glass.text : "transparent",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: isDark ? 6 : 0,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

function glassForVariant(
  variant: BtnVariant,
  isDark: boolean,
  colors: { text: string; textMuted: string; danger: string; accentBright: string },
  tube: string,
  edge: string,
) {
  if (variant === "tube") {
    return {
      gradient: isDark
        ? ([`${tube}33`, `${tube}12`] as const)
        : ([`${tube}28`, `${tube}10`] as const),
      border: edge,
      sheen: "rgba(255,255,255,0.55)",
      text: isDark ? tube : colors.text,
    };
  }
  if (variant === "primary") {
    return {
      gradient: isDark
        ? (["rgba(59,130,246,0.42)", "rgba(37,99,235,0.18)"] as const)
        : (["rgba(59,130,246,0.38)", "rgba(37,99,235,0.16)"] as const),
      border: isDark ? "rgba(147,197,253,0.45)" : "rgba(37,99,235,0.35)",
      sheen: "rgba(255,255,255,0.45)",
      text: isDark ? "#F0F7FF" : "#0B3A8A",
    };
  }
  if (variant === "danger") {
    return {
      gradient: isDark
        ? (["rgba(248,113,113,0.38)", "rgba(220,38,38,0.16)"] as const)
        : (["rgba(248,113,113,0.32)", "rgba(220,38,38,0.12)"] as const),
      border: isDark ? "rgba(252,165,165,0.45)" : "rgba(220,38,38,0.35)",
      sheen: "rgba(255,255,255,0.35)",
      text: isDark ? "#FEE2E2" : "#991B1B",
    };
  }
  if (variant === "ghost") {
    return {
      gradient: (["transparent", "transparent"] as const),
      border: "transparent",
      sheen: "transparent",
      text: colors.textMuted,
    };
  }
  return {
    gradient: isDark
      ? (["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"] as const)
      : (["rgba(255,255,255,0.75)", "rgba(255,255,255,0.4)"] as const),
    border: isDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.1)",
    sheen: isDark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.9)",
    text: colors.text,
  };
}

export function GlassIconButton({
  label,
  iconName,
  onPress,
  size = 36,
  style,
  click = "ui_tap",
}: {
  label?: string;
  iconName?: IconName;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  click?: TacticalClick | false;
}) {
  const { isDark, colors, mood } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (click) void tacticalClick(click);
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          shadowColor: mood.halo,
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]
            : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.45)"]
        }
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size / 2,
          borderWidth: StyleSheet.hairlineWidth * 1.5,
          borderColor: mood.edge,
        }}
      >
        {iconName ? (
          <Icon name={iconName} size={size * 0.42} color={mood.tube} strokeWidth={1.7} />
        ) : (
          <Text style={{ color: colors.text, fontSize: size * 0.36, fontWeight: "600" }}>
            {label}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** Circular action — enterprise icon, glass + halo */
export function GlassActionButton({
  icon,
  iconName,
  label,
  onPress,
  click = "ui_tap",
}: {
  icon?: string;
  iconName?: IconName;
  label: string;
  onPress: () => void;
  click?: TacticalClick | false;
}) {
  const { colors, isDark, mood } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (click) void tacticalClick(click);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        alignItems: "center",
        width: 62,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View
        style={{
          shadowColor: mood.halo,
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          marginBottom: 7,
        }}
      >
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,255,255,0.14)", "rgba(20,32,58,0.55)", "rgba(8,14,28,0.7)"]
              : ["rgba(255,255,255,0.95)", "rgba(219,234,254,0.55)"]
          }
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: StyleSheet.hairlineWidth * 1.5,
            borderColor: mood.edge,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 1,
              left: 10,
              right: 10,
              height: 1,
              backgroundColor: "rgba(255,255,255,0.5)",
            }}
          />
          {iconName ? (
            <Icon name={iconName} size={20} color={mood.tube} strokeWidth={1.75} />
          ) : (
            <Text style={{ color: mood.tube, fontSize: 16 }}>{icon}</Text>
          )}
        </LinearGradient>
      </View>
      <IlluminatedText
        tone="muted"
        glow={false}
        style={{
          fontSize: 11,
          fontWeight: "600",
          textAlign: "center",
          letterSpacing: 0.2,
        }}
        numberOfLines={1}
      >
        {label}
      </IlluminatedText>
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  iconName,
  onPress,
}: {
  label: string;
  /** @deprecated prefer iconName */
  icon?: string;
  iconName?: IconName;
  onPress?: () => void;
}) {
  const { colors, isDark, mood } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",
        borderRadius: radii.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark ? mood.edge : "rgba(15,23,42,0.1)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {iconName ? (
        <Icon name={iconName} size={12} color={mood.tube} />
      ) : icon ? (
        <Text style={{ fontSize: 11 }}>{icon}</Text>
      ) : null}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: "600",
          lineHeight: 13,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors, mood, isDark } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: space.sm,
      }}
    >
      <Text
        style={{
          color: isDark ? mood.textGlow : colors.text,
          fontSize: typography.section,
          fontWeight: "700",
          fontFamily: "System",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          textShadowColor: isDark ? mood.halo : "transparent",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: isDark ? 8 : 0,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text
            style={{
              color: colors.accentBright,
              fontSize: typography.caption,
              fontWeight: "600",
              fontFamily: "System",
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export { Icon, IconWell, IlluminatedText };
export type { IconName };
