import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GlassCard, PrimaryButton, Screen, SectionTitle } from "../components/ui";
import { colors, radii, space, typography } from "../theme";
import { PAYMENTS_URL } from "../lib/config";
import type { Screen as Route } from "../App";

const ACTIONS = [
  { key: "send", icon: "✈", label: "Send" },
  { key: "voice", icon: "↓", label: "Receive" },
  { key: "services", icon: "▣", label: "Pay" },
  { key: "services", icon: "⌂", label: "Cash out" },
  { key: "services", icon: "···", label: "More" },
] as const;

const ACTIVITY = [
  {
    name: "Ama Mensah",
    meta: "Today, 9:41 AM",
    amount: "+ GH₵ 200.00",
    positive: true,
    tag: "Received",
    icon: "👤",
  },
  {
    name: "MTN MoMo Top Up",
    meta: "Today, 8:15 AM",
    amount: "- GH₵ 50.00",
    positive: false,
    tag: "",
    icon: "📱",
  },
  {
    name: "Electricity Bill",
    meta: "Yesterday, 6:20 PM",
    amount: "- GH₵ 180.00",
    positive: false,
    tag: "",
    icon: "💡",
  },
  {
    name: "Nana Kwame",
    meta: "Yesterday, 2:10 PM",
    amount: "+ GH₵ 350.00",
    positive: true,
    tag: "Received",
    icon: "👤",
  },
];

export default function HomeScreen({
  go,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
}) {
  const [balance, setBalance] = useState<string>("GH₵ 12,560.80");
  const [usd, setUsd] = useState("≈ $1,245.60 USD");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `${PAYMENTS_URL}/v1/balances/${encodeURIComponent("user:demo-self:GHS")}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const minor = Number(data.balanceMinor ?? data.availableMinor ?? 0);
        const ghs = (minor / 100).toLocaleString("en-GH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        setBalance(`GH₵ ${ghs}`);
        setUsd(`≈ $${(minor / 100 / 10.08).toFixed(2)} USD`);
      } catch {
        /* keep mock showcase numbers from design */
      }
    })();
  }, []);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.menuBtn} onPress={() => go("services")}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <View style={styles.topRight}>
            <Pressable style={styles.bell}>
              <Text>🔔</Text>
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>E</Text>
            </View>
          </View>
        </View>

        <View style={styles.pad}>
          <Text style={styles.totalLabel}>Total balance  👁</Text>
          <Text style={styles.balance}>{balance}</Text>
          <Text style={styles.usd}>{usd}</Text>

          <View style={styles.actionRow}>
            {ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                style={styles.action}
                onPress={() => {
                  if (a.label === "Send") go("send");
                  else if (a.label === "Receive") go("voice");
                  else go(a.key as Route);
                }}
              >
                <View style={styles.actionCircle}>
                  <Text style={styles.actionIcon}>{a.icon}</Text>
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.accountsChip} onPress={() => go("services")}>
            <Text style={styles.accountsText}>Accounts  ▾</Text>
          </Pressable>

          <SectionTitle title="Recent activity" action="See all" />
          <GlassCard style={{ paddingVertical: 4 }}>
            {ACTIVITY.map((item) => (
              <View key={item.name + item.meta} style={styles.txRow}>
                <View style={styles.txIcon}>
                  <Text>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txName}>{item.name}</Text>
                  <Text style={styles.txMeta}>{item.meta}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: item.positive ? colors.success : colors.text },
                    ]}
                  >
                    {item.amount}
                  </Text>
                  {item.tag ? (
                    <Text style={styles.txTag}>{item.tag}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </GlassCard>
        </View>
      </ScrollView>

      <View style={styles.askBarWrap}>
        <Pressable style={styles.askBar} onPress={() => go("listening")}>
          <View style={styles.askOrb}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Ξ</Text>
          </View>
          <Text style={styles.askPlaceholder}>Ask Ephera anything…</Text>
          <Text style={styles.mic}>🎙</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 100,
  },
  pad: {
    paddingHorizontal: space.lg,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { color: colors.text, fontSize: 16 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.accentBright, fontWeight: "700" },
  totalLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginBottom: 6,
  },
  balance: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  usd: {
    color: colors.textDim,
    fontSize: typography.caption,
    marginTop: 4,
    marginBottom: space.lg,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  action: { alignItems: "center", width: 64 },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionIcon: { color: colors.accentBright, fontSize: 18 },
  actionLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: "600",
  },
  accountsChip: {
    alignSelf: "flex-end",
    marginBottom: space.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountsText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  txName: { color: colors.text, fontWeight: "600", fontSize: 14 },
  txMeta: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  txAmount: { fontWeight: "700", fontSize: 14 },
  txTag: { color: colors.success, fontSize: 10, marginTop: 2 },
  askBarWrap: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: 28,
  },
  askBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  askOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.orbCore,
    alignItems: "center",
    justifyContent: "center",
  },
  askPlaceholder: { flex: 1, color: colors.textDim, fontSize: 14 },
  mic: { fontSize: 16 },
});
