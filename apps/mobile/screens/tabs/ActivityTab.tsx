import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EpheraMark } from "../../components/EpheraMark";
import { GlassCard, Screen } from "../../components/ui";
import { useTheme } from "../../lib/theme-context";
import type { Screen as Route } from "../../lib/navigation";
import { space, type as typeStyles, typography } from "../../theme";

type Go = (screen: Route, params?: Record<string, string>) => void;
type Filter = "All" | "Pending" | "Failed" | "Bills" | "Cards" | "Savings";

const FILTERS: Filter[] = ["All", "Pending", "Failed", "Bills", "Cards", "Savings"];

type Tx = {
  name: string;
  meta: string;
  amount: string;
  status: "completed" | "pending" | "failed";
  up: boolean;
  cat: Filter | "All";
};

const ALL: { day: string; rows: Tx[] }[] = [
  {
    day: "Today",
    rows: [
      { name: "Ama Mensah", meta: "Received · MoMo", amount: "+ GH₵ 200.00", status: "completed", up: true, cat: "All" },
      { name: "MTN Airtime", meta: "Airtime · Self", amount: "- GH₵ 50.00", status: "completed", up: false, cat: "All" },
      { name: "DSTV Premium", meta: "Bill · Pending", amount: "- GH₵ 95.00", status: "pending", up: false, cat: "Bills" },
      { name: "Virtual Visa ·4281", meta: "Card · Purchase", amount: "- GH₵ 42.00", status: "completed", up: false, cat: "Cards" },
    ],
  },
  {
    day: "Yesterday",
    rows: [
      { name: "ECG Prepaid", meta: "Bill · Completed", amount: "- GH₵ 180.00", status: "completed", up: false, cat: "Bills" },
      { name: "Nana Kwame", meta: "Send · Failed", amount: "- GH₵ 350.00", status: "failed", up: false, cat: "All" },
      { name: "Emergency fund", meta: "Savings · Deposit", amount: "- GH₵ 100.00", status: "completed", up: false, cat: "Savings" },
    ],
  },
];

function matches(tx: Tx, f: Filter) {
  if (f === "All") return true;
  if (f === "Pending") return tx.status === "pending";
  if (f === "Failed") return tx.status === "failed";
  return tx.cat === f;
}

export default function ActivityTab({ go }: { go: Go }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>("All");

  const groups = useMemo(
    () =>
      ALL.map((g) => ({
        ...g,
        rows: g.rows.filter((r) => matches(r, filter)),
      })).filter((g) => g.rows.length > 0),
    [filter],
  );

  // Tab bar + orb clearance
  const bottomPad = Math.max(insets.bottom, 8) + 110;

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <EpheraMark size={26} />
          <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
        </View>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: typography.caption,
            marginTop: 4,
            fontWeight: "500",
          }}
        >
          History, receipts and recovery
        </Text>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: on
                      ? colors.accentSoft
                      : "rgba(255,255,255,0.06)",
                    borderColor: on ? colors.borderStrong : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: on ? colors.accentBright : colors.textMuted,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: bottomPad,
        }}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <GlassCard style={{ marginTop: 8 }}>
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              No {filter.toLowerCase()} activity yet.
            </Text>
          </GlassCard>
        ) : (
          groups.map((g) => (
            <View key={g.day} style={{ marginBottom: 16 }}>
              <Text style={[styles.day, { color: colors.textDim }]}>{g.day}</Text>
              <GlassCard style={{ paddingVertical: 2, paddingHorizontal: 4 }}>
                {g.rows.map((r, i) => (
                  <Pressable
                    key={r.name + r.meta}
                    onPress={() => {
                      if (r.status === "failed") {
                        go("failedPayment", { name: r.name, amount: r.amount });
                      } else {
                        go("receipt", {
                          name: r.name,
                          amount: r.amount,
                          status: r.status,
                        });
                      }
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      i < g.rows.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text
                        style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <Text
                        style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {r.meta}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontWeight: "700",
                          fontSize: 13,
                          color: r.up ? colors.success : colors.text,
                        }}
                      >
                        {r.amount}
                      </Text>
                      {r.status === "failed" ? (
                        <Text style={{ color: colors.danger, fontSize: 10, marginTop: 2 }}>
                          Recover →
                        </Text>
                      ) : r.status === "pending" ? (
                        <Text style={{ color: colors.warning, fontSize: 10, marginTop: 2 }}>
                          Pending
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </GlassCard>
            </View>
          ))
        )}

        <Pressable
          onPress={() => go("disputes")}
          style={({ pressed }) => [styles.dispute, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: colors.accentBright, fontWeight: "600", fontSize: 13 }}>
            Disputes & support cases →
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, marginBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { ...typeStyles.screenTitle, fontSize: 24 },
  filterWrap: { marginBottom: 10 },
  filters: {
    paddingHorizontal: space.lg,
    gap: 8,
    alignItems: "center",
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 34,
    justifyContent: "center",
  },
  day: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 52,
  },
  dispute: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
});
