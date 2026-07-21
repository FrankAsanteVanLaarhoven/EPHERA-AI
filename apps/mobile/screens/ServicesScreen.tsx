import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/ui";
import { colors, radii, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const ITEMS = [
  { icon: "✈", title: "Send Money", sub: "To anyone, anywhere", color: "#60A5FA" },
  { icon: "↓", title: "Receive Money", sub: "From anyone", color: "#34D399" },
  { icon: "▣", title: "Pay Bills", sub: "Airtime, utilities, TV & more", color: "#A78BFA" },
  { icon: "📱", title: "Buy Airtime & Data", sub: "Top up instantly", color: "#22D3EE" },
  { icon: "🏦", title: "Savings", sub: "Save and grow", color: "#4ADE80" },
  { icon: "📈", title: "Invest", sub: "Grow your money", color: "#C084FC" },
  { icon: "👤", title: "Loans", sub: "Instant & flexible", color: "#F472B6" },
  { icon: "🛡", title: "Insurance", sub: "Protect what matters", color: "#2DD4BF" },
  { icon: "💳", title: "Cards", sub: "Virtual & physical", color: "#FBBF24" },
  { icon: "🏪", title: "Merchant Payments", sub: "For businesses", color: "#FB923C" },
  { icon: "🌍", title: "Remittances", sub: "From diaspora", color: "#38BDF8" },
  { icon: "···", title: "More", sub: "Explore all features", color: "#94A3B8" },
];

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

      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.title}
            style={styles.tile}
            onPress={() => {
              if (item.title === "Send Money") go("send");
              else if (item.title.includes("Airtime")) go("send");
              else if (item.title === "More") go("voiceMode");
              else go("listening");
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
              <Text style={[styles.icon, { color: item.color }]}>{item.icon}</Text>
            </View>
            <Text style={styles.tileTitle}>{item.title}</Text>
            <Text style={styles.tileSub}>{item.sub}</Text>
          </Pressable>
        ))}
      </View>
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
    fontSize: typography.subtitle,
    fontWeight: "700",
    flex: 1,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: colors.textMuted },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    width: "30.5%",
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 118,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  icon: { fontSize: 16, fontWeight: "700" },
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
