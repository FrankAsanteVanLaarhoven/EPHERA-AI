import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  GlassCard,
  Icon,
  IconWell,
  PrimaryButton,
} from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatGhs } from "../lib/api";
import { loadInsightsSnapshot } from "../lib/insights-store";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

export default function InsightsScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors, mood, isDark } = useTheme();
  const data = useMemo(() => loadInsightsSnapshot(), []);
  const maxCat = Math.max(...data.categories.map((c) => c.minor), 1);
  const net = data.incomeMinor - data.spendMinor;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Insights"
        subtitle="Understandable, not generic charts"
        onBack={back}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 10 }}>
          {data.periodLabel}
        </Text>

        <View style={styles.kpiRow}>
          <GlassCard style={styles.kpi} halo>
            <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "800" }}>INCOME</Text>
            <Text style={{ color: colors.success, fontWeight: "800", fontSize: 18, marginTop: 6 }}>
              {formatGhs(data.incomeMinor)}
            </Text>
          </GlassCard>
          <GlassCard style={styles.kpi} halo>
            <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "800" }}>SPEND</Text>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18, marginTop: 6 }}>
              {formatGhs(data.spendMinor)}
            </Text>
          </GlassCard>
        </View>

        <GlassCard style={{ marginTop: 10 }} halo>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconWell name="chart" size={40} tone="accent" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700" }}>
                NET CASH FLOW
              </Text>
              <Text
                style={{
                  color: net >= 0 ? colors.success : colors.danger,
                  fontWeight: "800",
                  fontSize: 20,
                  marginTop: 2,
                }}
              >
                {formatGhs(net)}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 10, lineHeight: 17 }}>
            Forecast spend this month: {formatGhs(data.forecastMinor)}. Fees paid:{" "}
            {formatGhs(data.feeMinor)}.
          </Text>
        </GlassCard>

        <Text style={[styles.sec, { color: colors.textDim }]}>Spending by category</Text>
        <GlassCard halo>
          {data.categories.map((c) => (
            <View key={c.id} style={{ marginBottom: 12 }}>
              <View style={styles.catHead}>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, flex: 1 }}>
                  {c.label}
                </Text>
                <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 12 }}>
                  {formatGhs(c.minor)}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: "rgba(148,163,184,0.15)" }]}>
                <View
                  style={{
                    width: `${Math.max(4, (c.minor / maxCat) * 100)}%`,
                    height: "100%",
                    borderRadius: 4,
                    backgroundColor: c.color,
                  }}
                />
              </View>
            </View>
          ))}
        </GlassCard>

        <Text style={[styles.sec, { color: colors.textDim }]}>Subscriptions</Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
          {data.subscriptions.map((s, i) => (
            <View
              key={s.name}
              style={[
                styles.subRow,
                i < data.subscriptions.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <IconWell name="refresh" size={36} tone="cyan" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{s.name}</Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  Next {s.next}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {formatGhs(s.minor)}
              </Text>
            </View>
          ))}
        </GlassCard>

        <Text style={[styles.sec, { color: colors.textDim }]}>Recommendations</Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
          {data.alerts.map((a, i) => (
            <View
              key={a.id}
              style={[
                styles.subRow,
                i < data.alerts.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <IconWell
                name={a.severity === "warn" ? "alert" : a.severity === "ok" ? "check" : "info"}
                size={36}
                tone={
                  a.severity === "warn" ? "warning" : a.severity === "ok" ? "success" : "tube"
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                  {a.title}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                  {a.body}
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>

        <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 12, lineHeight: 16 }}>
          Recommendations are never silent or sponsored without a label. Data: your settled
          ledger activity on this device period.
        </Text>

        <View style={{ marginTop: 18, gap: 10 }}>
          <PrimaryButton
            label="Review bills"
            iconName="bolt"
            variant="secondary"
            onPress={() => go("bills")}
            click="svc_bills"
          />
          <PrimaryButton label="Back to Money" onPress={back} click="ui_back" />
          <PrimaryButton
            label="Open support"
            variant="ghost"
            onPress={() => go("support")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: { flex: 1 },
  sec: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  catHead: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  barTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
