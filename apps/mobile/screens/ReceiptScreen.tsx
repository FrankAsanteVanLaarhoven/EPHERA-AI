import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { TrustRow } from "../components/brand/TrustMarker";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

export default function ReceiptScreen({
  go,
  back,
  params,
}: {
  go: Go;
  back: () => void;
  params?: Record<string, string>;
}) {
  const { colors } = useTheme();
  const name = params?.name ?? "Transaction";
  const amount = params?.amount ?? "—";
  const status = params?.status ?? "completed";

  const rows = [
    ["Date & time", "21 Jul 2026 · 09:41 GMT"],
    ["Recipient", name],
    ["Amount", amount],
    ["Exchange rate", "n/a · same currency"],
    ["Fee", "GH₵ 0.00"],
    ["Payment rail", "EPHERA · mobile-money-sim"],
    ["Provider reference", "MM-9F2A-4410"],
    ["Settlement state", status],
    ["Authentication", "Passkey · device biometrics"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Receipt" subtitle="Evidence you can keep" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        <GlassCard style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>Status</Text>
          <Text style={{ color: colors.success, fontWeight: "800", fontSize: 16, marginTop: 4 }}>
            {status.toUpperCase()}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 12 }}>
            {amount}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{name}</Text>
          <View style={{ marginTop: 14 }}>
            <TrustRow
              kinds={[
                "settled",
                "verifiedRecipient",
                "feeDisclosed",
                "passkey",
                "regulatedProvider",
              ]}
            />
          </View>
        </GlassCard>

        <GlassCard style={{ marginBottom: 16 }}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={{ color: colors.textDim, fontSize: 12, width: "40%" }}>{k}</Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" }}>
                {v}
              </Text>
            </View>
          ))}
        </GlassCard>

        <PrimaryButton label="Download receipt" variant="secondary" onPress={() => {}} />
        <View style={{ height: 10 }} />
        <PrimaryButton label="Dispute this payment" variant="ghost" onPress={() => go("disputes")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
});
