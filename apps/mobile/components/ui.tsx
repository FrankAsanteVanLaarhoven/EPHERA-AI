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
import { colors, radii, space, typography } from "../theme";

export function Screen({
  children,
  style,
  edges = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: boolean;
}) {
  return (
    <View style={[styles.screen, edges && styles.screenPad, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(37,99,235,0.12)", "transparent", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  if (variant === "primary") {
    return (
      <Pressable disabled={disabled} onPress={onPress} style={disabled && { opacity: 0.45 }}>
        <LinearGradient
          colors={["#3B82F6", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          {icon ? <Text style={styles.btnIcon}>{icon}</Text> : null}
          <Text style={styles.btnText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        variant === "danger" && styles.btnDanger,
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon ? <Text style={styles.btnIcon}>{icon}</Text> : null}
      <Text
        style={[
          styles.btnText,
          variant === "ghost" && { color: colors.textMuted },
          variant === "secondary" && { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      {icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={styles.chipText}>{label}</Text>
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
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
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
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenPad: {
    paddingHorizontal: space.lg,
    paddingTop: 56,
    paddingBottom: space.lg,
  },
  glass: {
    backgroundColor: "rgba(12, 21, 38, 0.82)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  btn: {
    minHeight: 54,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: space.lg,
  },
  btnSecondary: {
    backgroundColor: "rgba(18, 29, 50, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.45)",
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: "700",
  },
  btnIcon: {
    fontSize: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(8, 15, 30, 0.75)",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipIcon: { fontSize: 12 },
  chipText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
  },
  sectionAction: {
    color: colors.accentBright,
    fontSize: typography.caption,
    fontWeight: "600",
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
