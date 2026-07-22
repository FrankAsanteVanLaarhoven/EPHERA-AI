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
  const status = params?.status ?? "unknown";

  // Only fields the ledger actually issued may appear here. A receipt is
  // evidence, and the ledger writes it — with the real provider reference, fee,
  // journal entry and authorisation method — in the same transaction as the
  // posting. The mobile app cannot yet authorise a payment on device (it has no
  // native passkey module), so it does not receive one of those receipts, and
  // it must not invent the fields as if it had. Everything below is either a
  // value that was genuinely passed in, or is marked as not available.
  //
  // Previously this screen hardcoded a date, a "GH₵ 0.00" fee, a
  // "MM-9F2A-4410" provider reference and an "Authentication: Passkey · device
  // biometrics" line, and rendered a green settled/verified trust row — all
  // fabricated, and shown even when the send had only been queued or had
  // failed.
  const na = "not available on device yet";
  const rows: [string, string][] = [
    ["Recipient", name],
    ["Amount", amount],
    ["Status", status],
    ["Provider reference", params?.providerRef ?? na],
    ["Fee", params?.fee ?? na],
    ["Ledger journal entry", params?.journalEntryId ?? na],
    ["Authorisation", params?.method ?? na],
  ];
  const settled = status.toLowerCase() === "settled";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Receipt" subtitle="What actually happened" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        <GlassCard style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>Status</Text>
          <Text
            style={{
              color: settled ? colors.success : colors.textMuted,
              fontWeight: "800",
              fontSize: 16,
              marginTop: 4,
            }}
          >
            {status.toUpperCase()}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 12 }}>
            {amount}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{name}</Text>
          {settled ? (
            <View style={{ marginTop: 14 }}>
              <TrustRow kinds={["settled", "feeDisclosed"]} />
            </View>
          ) : (
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 12, lineHeight: 17 }}>
              A verifiable receipt — with the provider reference, fee, journal entry and
              authorisation method — is issued by the ledger when a payment settles. On-device
              payment authorisation is not available yet, so those fields are not shown as if
              they were.
            </Text>
          )}
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
