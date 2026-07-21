import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const ACCOUNTS = [
  {
    name: "EPHERA Wallet",
    provider: "Ephera · Safeguarded",
    available: "GH₵ 800.00",
    pending: "GH₵ 0.00",
    default: true,
    sync: "Just now",
    protect: "Deposit protected",
  },
  {
    name: "GCB Current",
    provider: "GCB Bank",
    available: "GH₵ 4,250.00",
    pending: "GH₵ 120.00",
    default: false,
    sync: "2 min ago",
    protect: "Bank deposit insurance",
  },
  {
    name: "MTN MoMo",
    provider: "MTN Mobile Money",
    available: "GH₵ 310.50",
    pending: "GH₵ 0.00",
    default: false,
    sync: "5 min ago",
    protect: "Telco float",
  },
  {
    name: "Virtual Visa ·••4281",
    provider: "Ephera Card",
    available: "Linked to wallet",
    pending: "—",
    default: false,
    sync: "Live",
    protect: "Freeze anytime",
  },
  {
    name: "USD Balance",
    provider: "Ephera FX",
    available: "$ 84.20",
    pending: "$ 0.00",
    default: false,
    sync: "Live",
    protect: "Segregated FX",
  },
];

export default function AccountsScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Accounts & wallets" subtitle="Sources of money" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {ACCOUNTS.map((a) => (
          <GlassCard key={a.name} style={{ marginBottom: 12 }}>
            <View style={styles.row}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, flex: 1 }}>
                {a.name}
              </Text>
              {a.default ? (
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: "700" }}>DEFAULT</Text>
              ) : null}
            </View>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{a.provider}</Text>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "600", marginTop: 12 }}>
              {a.available}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              Pending {a.pending}
            </Text>
            <View style={[styles.meta, { borderTopColor: colors.border }]}>
              <Text style={{ color: colors.textDim, fontSize: 11 }}>Sync · {a.sync}</Text>
              <Text style={{ color: colors.textDim, fontSize: 11 }}>{a.protect}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable>
                <Text style={{ color: colors.accentBright, fontSize: 12, fontWeight: "600" }}>
                  {a.default ? "Default" : "Set default"}
                </Text>
              </Pressable>
              <Pressable>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600" }}>
                  Unlink
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        ))}
        <PrimaryButton label="Link account" variant="secondary" onPress={() => go("identity")} size="md" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
});
