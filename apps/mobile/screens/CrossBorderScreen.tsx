import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const ROUTES = [
  {
    id: "best",
    name: "Recommended · MoMo corridor",
    receive: "NGN 98,400",
    fee: "GH₵ 12.00",
    rate: "1 GHS = 98.4 NGN",
    eta: "Under 10 min",
    reverse: "Usually reversible within 24h if unclaimed",
    best: true,
  },
  {
    id: "bank",
    name: "Bank deposit · GTBank",
    receive: "NGN 97,900",
    fee: "GH₵ 18.00",
    rate: "1 GHS = 97.9 NGN",
    eta: "Same day",
    reverse: "Bank recall rules apply",
    best: false,
  },
  {
    id: "card",
    name: "Card payout",
    receive: "NGN 96,800",
    fee: "GH₵ 28.00",
    rate: "1 GHS = 96.8 NGN",
    eta: "Minutes",
    reverse: "Card scheme rules",
    best: false,
  },
];

export default function CrossBorderScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState("best");
  const route = ROUTES.find((r) => r.id === selected)!;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Cross-border" subtitle="Compare full cost before you send" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <GlassCard style={{ marginBottom: 12 }}>
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textDim, fontSize: 11 }}>You send</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>GH₵ 1,000</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Ghana</Text>
            </View>
            <Text style={{ color: colors.accentBright, fontSize: 18 }}>→</Text>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={{ color: colors.textDim, fontSize: 11 }}>They receive</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{route.receive}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Nigeria · MoMo</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={[styles.section, { color: colors.textDim }]}>Routes</Text>
        {ROUTES.map((r) => {
          const on = r.id === selected;
          return (
            <Pressable key={r.id} onPress={() => setSelected(r.id)}>
              <GlassCard
                style={{
                  marginBottom: 10,
                  borderColor: on ? colors.borderStrong : undefined,
                  borderWidth: on ? 1.5 : undefined,
                }}
              >
                <View style={styles.row}>
                  <Text style={{ color: colors.text, fontWeight: "700", flex: 1, fontSize: 14 }}>
                    {r.name}
                  </Text>
                  {r.best ? (
                    <Text style={{ color: colors.success, fontSize: 10, fontWeight: "800" }}>
                      BEST
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                  Fee {r.fee} · {r.rate}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4 }}>
                  ETA {r.eta}
                </Text>
              </GlassCard>
            </Pressable>
          );
        })}

        <GlassCard style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>
            Full cost summary
          </Text>
          {[
            ["You pay", "GH₵ 1,012.00"],
            ["Provider fee", route.fee],
            ["Exchange rate", route.rate],
            ["Recipient gets", route.receive],
            ["Arrival", route.eta],
            ["Reversibility", route.reverse],
          ].map(([k, v]) => (
            <View key={k} style={styles.sumRow}>
              <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>{k}</Text>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", flex: 1.2, textAlign: "right" }}>
                {v}
              </Text>
            </View>
          ))}
        </GlassCard>

        <PrimaryButton
          label="Continue to review"
          onPress={() =>
            go("send", {
              intentJson: JSON.stringify({
                id: `xborder_${Date.now()}`,
                name: "send_money",
                language: "en",
                confidence: 0.9,
                amount: { amountMinor: 100000, currency: "GHS" },
                recipient: {
                  displayName: "Nigeria recipient",
                  verified: true,
                  accountHint: "MoMo corridor",
                },
                createdAt: new Date().toISOString(),
              }),
            })
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", alignItems: "center", gap: 12 },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  sumRow: { flexDirection: "row", marginBottom: 8 },
});
