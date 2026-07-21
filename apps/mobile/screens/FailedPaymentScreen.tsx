import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const STEPS = [
  { label: "Payment created", state: "done" as const },
  { label: "Funds reserved", state: "done" as const },
  { label: "Provider contacted", state: "done" as const },
  { label: "Recipient settlement", state: "failed" as const },
  { label: "Refund initiated", state: "progress" as const },
];

export default function FailedPaymentScreen({
  back,
  go,
  params,
}: {
  go: Go;
  back: () => void;
  params?: Record<string, string>;
}) {
  const { colors } = useTheme();
  const name = params?.name ?? "Transfer";
  const amount = params?.amount ?? "—";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Payment recovery" subtitle="Case EP-2026-04821" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <GlassCard style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.danger, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 }}>
            FAILED
          </Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 6 }}>
            {name}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{amount}</Text>
        </GlassCard>

        <GlassCard style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            What happened
          </Text>
          {[
            ["What failed?", "Recipient settlement at the provider"],
            ["Was money deducted?", "Yes — held as a temporary reserve"],
            ["Where is the money now?", "Reserved on your wallet, refund in progress"],
            ["Is a retry safe?", "Yes after refund settles (usually < 2 hours)"],
            ["When will money return?", "Typically within 2 business hours"],
            ["Who is responsible?", "Rail provider · case with Ephera support"],
            ["Case reference", "EP-2026-04821"],
            ["Next update", "Within 4 hours or on settlement"],
          ].map(([q, a]) => (
            <View key={q} style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.textDim, fontSize: 11 }}>{q}</Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", marginTop: 2 }}>
                {a}
              </Text>
            </View>
          ))}
        </GlassCard>

        <GlassCard style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 14 }}>Timeline</Text>
          {STEPS.map((s, i) => (
            <View key={s.label} style={styles.step}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        s.state === "done"
                          ? colors.success
                          : s.state === "failed"
                            ? colors.danger
                            : colors.warning,
                    },
                  ]}
                />
                {i < STEPS.length - 1 ? (
                  <View style={[styles.line, { backgroundColor: colors.border }]} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                  {s.label}
                </Text>
                <Text
                  style={{
                    color:
                      s.state === "done"
                        ? colors.success
                        : s.state === "failed"
                          ? colors.danger
                          : colors.warning,
                    fontSize: 11,
                    marginTop: 2,
                    fontWeight: "700",
                  }}
                >
                  {s.state === "done" ? "✓ Done" : s.state === "failed" ? "✕ Failed" : "… In progress"}
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>

        <PrimaryButton label="Contact support" variant="secondary" onPress={() => go("support")} />
        <View style={{ height: 10 }} />
        <PrimaryButton label="Done" variant="ghost" onPress={back} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 12 },
  rail: { width: 16, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  line: { width: 2, flex: 1, marginVertical: 2 },
});
