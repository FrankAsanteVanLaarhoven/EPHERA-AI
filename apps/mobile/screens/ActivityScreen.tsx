import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const ITEMS = [
  {
    day: "Today",
    rows: [
      { name: "Ama Mensah", meta: "9:41 AM · Received", amount: "+ GH₵ 200.00", positive: true, color: "#3B82F6", avatar: "A" },
      { name: "MTN MoMo Top Up", meta: "8:15 AM · Airtime", amount: "- GH₵ 50.00", positive: false, color: "#FBBF24", avatar: "M" },
    ],
  },
  {
    day: "Yesterday",
    rows: [
      { name: "Electricity Bill", meta: "6:20 PM · Bills", amount: "- GH₵ 180.00", positive: false, color: "#A78BFA", avatar: "⚡" },
      { name: "Nana Kwame", meta: "2:10 PM · Received", amount: "+ GH₵ 350.00", positive: true, color: "#34D399", avatar: "N" },
      { name: "DSTV Premium", meta: "11:02 AM · Bills", amount: "- GH₵ 95.00", positive: false, color: "#F472B6", avatar: "📺" },
    ],
  },
];

export default function ActivityScreen({
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  return (
    <Screen>
      <Pressable onPress={back}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.sub}>All money in and out of your wallet.</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {ITEMS.map((group) => (
          <View key={group.day} style={{ marginTop: space.lg }}>
            <Text style={styles.day}>{group.day}</Text>
            <GlassCard style={{ paddingVertical: 2 }}>
              {group.rows.map((item, i) => (
                <View
                  key={item.name + item.meta}
                  style={[
                    styles.row,
                    i === group.rows.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: `${item.color}33` }]}>
                    <Text style={{ color: item.color, fontWeight: "700" }}>{item.avatar}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{item.meta}</Text>
                  </View>
                  <Text
                    style={[
                      styles.amount,
                      { color: item.positive ? colors.success : colors.text },
                    ]}
                  >
                    {item.amount}
                  </Text>
                </View>
              ))}
            </GlassCard>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.accentBright, fontWeight: "600", marginBottom: space.sm },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "700",
  },
  sub: { color: colors.textMuted, marginTop: 4, marginBottom: 4 },
  day: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.text, fontWeight: "600", fontSize: 14 },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  amount: { fontWeight: "700", fontSize: 14 },
});
