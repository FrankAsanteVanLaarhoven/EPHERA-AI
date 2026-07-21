import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard, Screen, SectionTitle } from "../components/ui";
import { colors, radii, space, typography } from "../theme";
import { PAYMENTS_URL } from "../lib/config";
import type { Screen as Route } from "../App";

const ACTIONS = [
  { label: "Send", icon: "✈", go: "send" as const },
  { label: "Receive", icon: "↓", go: "listening" as const },
  { label: "Pay", icon: "▣", go: "services" as const },
  { label: "Cash out", icon: "⌂", go: "services" as const },
  { label: "More", icon: "···", go: "services" as const },
];

const ACTIVITY = [
  {
    name: "Ama Mensah",
    meta: "Today, 9:41 AM",
    amount: "+ GH₵ 200.00",
    positive: true,
    tag: "Received",
    avatar: "A",
    color: "#3B82F6",
  },
  {
    name: "MTN MoMo Top Up",
    meta: "Today, 8:15 AM",
    amount: "- GH₵ 50.00",
    positive: false,
    tag: "",
    avatar: "M",
    color: "#FBBF24",
  },
  {
    name: "Electricity Bill",
    meta: "Yesterday, 6:20 PM",
    amount: "- GH₵ 180.00",
    positive: false,
    tag: "",
    avatar: "⚡",
    color: "#A78BFA",
  },
  {
    name: "Nana Kwame",
    meta: "Yesterday, 2:10 PM",
    amount: "+ GH₵ 350.00",
    positive: true,
    tag: "Received",
    avatar: "N",
    color: "#34D399",
  },
];

export default function HomeScreen({
  go,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
}) {
  const [balance, setBalance] = useState("GH₵ 12,560.80");
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
        if (!minor) return;
        const ghs = (minor / 100).toLocaleString("en-GH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        setBalance(`GH₵ ${ghs}`);
        setUsd(`≈ $${(minor / 100 / 10.08).toFixed(2)} USD`);
      } catch {
        /* design showcase numbers remain */
      }
    })();
  }, []);

  return (
    <Screen edges={false} style={{ paddingTop: 52 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.menuBtn} onPress={() => go("services")}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <View style={styles.topRight}>
            <Pressable style={styles.iconCircle}>
              <Text>🔔</Text>
            </Pressable>
            <LinearGradient
              colors={["#3B82F6", "#8B5CF6"]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>E</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.pad}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.totalLabel}>Total balance  👁</Text>
              <Text style={styles.balance}>{balance}</Text>
              <Text style={styles.usd}>{usd}</Text>
            </View>
            <Pressable style={styles.accountsChip} onPress={() => go("services")}>
              <Text style={styles.accountsText}>Accounts  ▾</Text>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            {ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                style={styles.action}
                onPress={() => go(a.go)}
              >
                <View style={styles.actionCircle}>
                  <Text style={styles.actionIcon}>{a.icon}</Text>
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle title="Recent activity" action="See all" />
          <GlassCard style={{ paddingVertical: 2 }}>
            {ACTIVITY.map((item, i) => (
              <View
                key={item.name + item.meta}
                style={[
                  styles.txRow,
                  i === ACTIVITY.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.txIcon, { backgroundColor: `${item.color}33` }]}>
                  <Text style={{ color: item.color, fontWeight: "700" }}>
                    {item.avatar}
                  </Text>
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
                  {item.tag ? <Text style={styles.txTag}>{item.tag}</Text> : null}
                </View>
              </View>
            ))}
          </GlassCard>

          <Pressable style={styles.freezeLink} onPress={() => go("freeze")}>
            <Text style={styles.freezeText}>Freeze wallet  ·  Security</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.askBarWrap}>
        <Pressable style={styles.askBar} onPress={() => go("listening")}>
          <LinearGradient colors={["#2563EB", "#7C3AED"]} style={styles.askOrb}>
            <Text style={styles.askOrbText}>Ξ</Text>
          </LinearGradient>
          <Text style={styles.askPlaceholder}>Ask Ephera anything…</Text>
          <Text style={styles.mic}>🎙</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 110 },
  pad: { paddingHorizontal: space.lg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(18,29,50,0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { color: colors.text, fontSize: 16 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,29,50,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: space.lg,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  balance: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  usd: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 4,
  },
  accountsChip: {
    backgroundColor: "rgba(18,29,50,0.95)",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  accountsText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.xl,
  },
  action: { alignItems: "center", width: 62 },
  actionCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(18,29,50,0.95)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionIcon: { color: colors.accentBright, fontSize: 18 },
  actionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  txName: { color: colors.text, fontWeight: "600", fontSize: 14 },
  txMeta: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  txAmount: { fontWeight: "700", fontSize: 14 },
  txTag: { color: colors.success, fontSize: 10, marginTop: 2 },
  freezeLink: { marginTop: space.md, alignItems: "center" },
  freezeText: { color: colors.textDim, fontSize: 12 },
  askBarWrap: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: 28,
  },
  askBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(12, 21, 38, 0.96)",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  askOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  askOrbText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  askPlaceholder: { flex: 1, color: colors.textDim, fontSize: 14 },
  mic: { fontSize: 16 },
});
