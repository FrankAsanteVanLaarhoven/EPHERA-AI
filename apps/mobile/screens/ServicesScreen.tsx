import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/ui";
import { colors, radii, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const ITEMS = [
  { icon: "✈", title: "Send Money", sub: "To anyone, anywhere", color: "#60A5FA", go: "send" },
  { icon: "↓", title: "Receive Money", sub: "From anyone", color: "#34D399", go: "listening" },
  { icon: "▣", title: "Pay Bills", sub: "Airtime, utilities, TV & more", color: "#A78BFA", go: "listening" },
  { icon: "📱", title: "Buy Airtime & Data", sub: "Top up instantly", color: "#22D3EE", go: "send" },
  { icon: "🏦", title: "Savings", sub: "Save and grow", color: "#4ADE80", go: "listening" },
  { icon: "📈", title: "Invest", sub: "Grow your money", color: "#C084FC", go: "listening" },
  { icon: "👤", title: "Loans", sub: "Instant & flexible", color: "#F472B6", go: "listening" },
  { icon: "🛡", title: "Insurance", sub: "Protect what matters", color: "#2DD4BF", go: "listening" },
  { icon: "💳", title: "Cards", sub: "Virtual & physical", color: "#FBBF24", go: "listening" },
  { icon: "🏪", title: "Merchant Payments", sub: "For businesses", color: "#FB923C", go: "listening" },
  { icon: "🌍", title: "Remittances", sub: "From diaspora", color: "#38BDF8", go: "listening" },
  { icon: "···", title: "More", sub: "Explore all features", color: "#94A3B8", go: "voiceMode" },
] as const;

export default function ServicesScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Ephera can help you with</Text>
        <Pressable onPress={back} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.title}
              style={styles.tile}
              onPress={() => go(item.go as Route)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
                <Text style={{ fontSize: 16 }}>{item.icon}</Text>
              </View>
              <Text style={styles.tileTitle}>{item.title}</Text>
              <Text style={styles.tileSub}>{item.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.lg,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    paddingRight: 12,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(18,29,50,0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.textMuted, fontSize: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 24,
  },
  tile: {
    width: "31%",
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: "rgba(12, 21, 38, 0.92)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 120,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  tileSub: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 13,
  },
});
