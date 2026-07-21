import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme-context";
import { GlassIconButton } from "./ui";
import { typography } from "../theme";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        {onBack ? (
          <GlassIconButton iconName="arrowLeft" onPress={onBack} size={34} label="Back" />
        ) : (
          <View style={{ width: 34 }} />
        )}
        <View style={styles.titles}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: colors.textDim }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ?? <View style={{ width: 34 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titles: { flex: 1, alignItems: "center" },
  title: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "System",
    letterSpacing: 0.15,
  },
  sub: {
    fontSize: typography.micro,
    marginTop: 1,
    fontFamily: "System",
    fontWeight: "500",
  },
});
