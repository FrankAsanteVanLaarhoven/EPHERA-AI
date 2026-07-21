import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, GlassIconButton } from "../components/ui";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const CATALOG: {
  group: string;
  items: { title: string; go: Route; pin?: boolean }[];
}[] = [
  {
    group: "Everyday money",
    items: [
      { title: "Send", go: "send", pin: true },
      { title: "Receive", go: "receive", pin: true },
      { title: "Bills", go: "bills", pin: true },
      { title: "Airtime", go: "airtime", pin: true },
      { title: "Cash out", go: "send" },
      { title: "Cards", go: "cards" },
    ],
  },
  {
    group: "Grow and protect",
    items: [
      { title: "Savings", go: "savings" },
      { title: "Insurance", go: "insurance" },
      { title: "Credit", go: "credit" },
      { title: "Investments", go: "invest" },
    ],
  },
  {
    group: "International",
    items: [
      { title: "Remittances", go: "crossBorder" },
      { title: "Currency exchange", go: "exchange" },
      { title: "International card", go: "cards" },
    ],
  },
  {
    group: "Business",
    items: [
      { title: "Accept payments", go: "merchant" },
      { title: "Invoices", go: "merchant" },
      { title: "Payment links", go: "receive" },
    ],
  },
  {
    group: "Support and safety",
    items: [
      { title: "Freeze account", go: "freeze" },
      { title: "Disputes", go: "disputes" },
      { title: "Identity", go: "identity" },
      { title: "Security", go: "security" },
      { title: "Customer support", go: "support" },
    ],
  },
  {
    group: "Product overview",
    items: [
      { title: "Design dashboard", go: "board", pin: true },
    ],
  },
];

export default function ServicesDrawerScreen({
  go,
  back,
}: {
  go: Go;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return CATALOG;
    return CATALOG.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.title.toLowerCase().includes(term)),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 6 }}>
      <View style={styles.header}>
        <GlassIconButton label="✕" onPress={back} size={34} />
        <Text style={[styles.title, { color: colors.text }]}>Services</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={[styles.searchWrap, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textDim, marginRight: 8 }}>⌕</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={colors.textDim}
          style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 }}
          autoCorrect={false}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 14, lineHeight: 17 }}>
          Pin frequent services from here. Voice is only available from the orb — not as a menu brand.
        </Text>

        {filtered.map((g) => (
          <View key={g.group} style={{ marginBottom: 18 }}>
            <Text style={[styles.group, { color: colors.textDim }]}>{g.group}</Text>
            <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
              {g.items.map((item, i) => (
                <Pressable
                  key={item.title}
                  onPress={() => go(item.go)}
                  style={[
                    styles.row,
                    i < g.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ flex: 1, color: colors.text, fontWeight: "600", fontSize: 14 }}>
                    {item.title}
                  </Text>
                  {item.pin ? (
                    <Text style={{ color: colors.accentBright, fontSize: 10, fontWeight: "700", marginRight: 8 }}>
                      PIN
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.textDim }}>›</Text>
                </Pressable>
              ))}
            </GlassCard>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  group: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
});
