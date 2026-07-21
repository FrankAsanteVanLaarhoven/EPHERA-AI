import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme-context";
import { tacticalClick } from "../lib/tactical-clicks";
import { TABS, type TabId } from "../lib/navigation";
import { Icon } from "./icons/Icon";

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

/**
 * Five-destination bar — glass HUD chrome.
 * Voice is intentionally NOT a tab (orb floats above).
 */
export function TabBar({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, mood } = useTheme();
  const bottom = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: bottom,
          borderTopColor: isDark ? mood.edge : "rgba(15,23,42,0.08)",
          backgroundColor: isDark
            ? "rgba(3,6,14,0.88)"
            : "rgba(243,246,251,0.9)",
        },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? [`${mood.halo}12`, "transparent"]
            : ["rgba(255,255,255,0.6)", "transparent"]
        }
        style={StyleSheet.absoluteFill}
      />
      {TABS.map((tab) => {
        const on = active === tab.id;
        const c = on ? mood.tube : colors.textDim;
        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              void tacticalClick("ui_tab");
              onChange(tab.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [
              styles.item,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View
              style={
                on
                  ? {
                      shadowColor: mood.halo,
                      shadowOpacity: isDark ? 0.7 : 0.25,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                    }
                  : undefined
              }
            >
              <Icon name={tab.icon} size={18} color={c} strokeWidth={on ? 1.85 : 1.55} />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: c,
                  fontWeight: on ? "700" : "500",
                  textShadowColor: on && isDark ? mood.halo : "transparent",
                  textShadowRadius: on && isDark ? 6 : 0,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {on ? (
              <View style={[styles.dot, { backgroundColor: mood.tube }]} />
            ) : (
              <View style={styles.dotSpacer} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minHeight: 48,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.3,
    fontFamily: "System",
    marginTop: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  dotSpacer: { height: 7 },
});
