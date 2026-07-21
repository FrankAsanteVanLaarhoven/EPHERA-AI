import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const GOALS = [
  {
    name: "Emergency fund",
    current: 1860,
    target: 3000,
    days: 90,
    suggest: 40,
    rules: "Withdraw anytime · no lock",
    returnNote: "0% demo · safeguarded cash",
  },
  {
    name: "School fees",
    current: 2400,
    target: 5000,
    days: 120,
    suggest: 75,
    rules: "Restricted purpose · education",
    returnNote: "Locked until term start",
  },
  {
    name: "Travel",
    current: 620,
    target: 4000,
    days: 200,
    suggest: 50,
    rules: "Scheduled deposits weekly",
    returnNote: "Round-ups enabled",
  },
];

export default function SavingsScreen({ go, back }: { go: Go; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Savings" subtitle="Practical goals, clear rules" onBack={back} />
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        }}
      >
        <GlassCard style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>Total in pots</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 4 }}>
            GH₵ 4,880.00
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Across {GOALS.length} goals · round-ups on
          </Text>
        </GlassCard>

        {GOALS.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          return (
            <GlassCard key={g.name} style={{ marginBottom: 12 }}>
              <View style={styles.row}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, flex: 1 }}>
                  {g.name}
                </Text>
                <Text style={{ color: colors.accentBright, fontWeight: "700" }}>{pct}%</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 8 }}>
                GH₵ {g.current.toLocaleString()}
                <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: "500" }}>
                  {" "}
                  / {g.target.toLocaleString()}
                </Text>
              </Text>
              <View style={[styles.track, { backgroundColor: "rgba(148,163,184,0.2)" }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${pct}%`, backgroundColor: colors.success },
                  ]}
                />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                ~{g.days} days left · suggest GH₵ {g.suggest}/wk
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 6 }}>
                Rules: {g.rules}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                Return: {g.returnNote}
              </Text>
              <View style={styles.actions}>
                <Pressable onPress={() => go("send")}>
                  <Text style={{ color: colors.accentBright, fontWeight: "700", fontSize: 13 }}>
                    Add money
                  </Text>
                </Pressable>
                <Pressable onPress={() => go("support")}>
                  <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 13 }}>
                    Withdraw rules
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          );
        })}

        <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
          Also: automatic round-ups, family circles, education fund, business reserve, locked
          savings. Every pot shows target, time, contribution and withdrawal rules before you lock.
        </Text>
        <PrimaryButton label="Create new goal" onPress={() => go("support")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  track: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
  actions: {
    flexDirection: "row",
    gap: 18,
    marginTop: 12,
  },
});
