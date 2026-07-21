import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import {
  GlassActionButton,
  GlassCard,
  GlassIconButton,
  Screen,
  SectionTitle,
} from "../components/ui";
import { fetchBalance, formatGhs, formatUsdApprox } from "../lib/api";
import { useProfile } from "../lib/profile";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { colors as themeColors, radii, space } from "../theme";
import type { Screen as Route } from "../App";

const ACTION_DEFS = [
  { labelKey: "nav.send", icon: "✈", go: "send" as const },
  { labelKey: "nav.receive", icon: "↓", go: "receive" as const },
  { labelKey: "nav.pay", icon: "▣", go: "bills" as const },
  { labelKey: "nav.invest", icon: "📈", go: "invest" as const },
  { labelKey: "common.more", icon: "···", go: "servicesDrawer" as const },
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
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { colors } = useTheme();
  const t = useT();
  const [balance, setBalance] = useState("GH₵ 12,560.80");
  const [usd, setUsd] = useState("≈ $1,245.60 USD");
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchBalance();
    if (!data) return;
    setBalance(formatGhs(data.availableMinor || data.balanceMinor));
    setUsd(formatUsdApprox(data.availableMinor || data.balanceMinor));
    setWalletStatus(data.status === "frozen" ? "frozen" : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const ACTIONS = ACTION_DEFS.map((a) => ({ ...a, label: t(a.labelKey) }));

  const displayBalance = hidden ? "GH₵ ••••••" : balance;
  const displayUsd = hidden ? "≈ $••••" : usd;

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 8 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accentBright}
          />
        }
      >
        <View style={styles.topBar}>
          <GlassIconButton label="☰" onPress={() => go("servicesDrawer")} size={36} />
          <View style={styles.topRight}>
            <View>
              <GlassIconButton label="⚙" onPress={() => go("settings")} size={36} />
              <View style={styles.dot} />
            </View>
            <Avatar size={36} onPress={() => go("profile")} />
          </View>
        </View>

        <View style={styles.pad}>
          {walletStatus === "frozen" ? (
            <Pressable style={styles.frozenBanner} onPress={() => go("freeze")}>
              <Text style={[styles.frozenText, { color: colors.danger }]}>
                🛡 {t("home.frozenBanner")}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.balanceHeader}>
            <View style={{ flex: 1 }}>
              <Pressable
                style={styles.totalLabelRow}
                onPress={() => setHidden((h) => !h)}
              >
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t("home.totalBalance")}</Text>
                <Text style={styles.eye}>{hidden ? "👁‍🗨" : "👁"}</Text>
              </Pressable>
              <Text style={[styles.balance, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {displayBalance}
              </Text>
              <Text style={styles.usd}>{displayUsd}</Text>
              <Text style={[styles.greeting, { color: colors.textDim }]}>
                {t("home.hi", { name: profile.displayName.split(" ")[0] })} · {profile.kycTier}
              </Text>
            </View>
            <Pressable style={styles.accountsChip} onPress={() => go("accounts")}>
              <Text style={[styles.accountsText, { color: colors.textMuted }]}>
                {t("home.accounts")}  ▾
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            {ACTIONS.map((a) => (
              <GlassActionButton
                key={a.label}
                icon={a.icon}
                label={a.label}
                onPress={() => go(a.go)}
              />
            ))}
          </View>

          <SectionTitle title={t("home.recentActivity")} action={t("common.seeAll")} onAction={() => go("activity")} />
          <GlassCard style={{ paddingVertical: 2 }}>
            {ACTIVITY.map((item, i) => (
              <Pressable
                key={item.name + item.meta}
                style={[
                  styles.txRow,
                  i === ACTIVITY.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => go("activity")}
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
                    {hidden ? "••••" : item.amount}
                  </Text>
                  {item.tag ? <Text style={styles.txTag}>{item.tag}</Text> : null}
                </View>
              </Pressable>
            ))}
          </GlassCard>

          <Pressable style={styles.freezeLink} onPress={() => go("freeze")}>
            <Text style={[styles.freezeText, { color: colors.textDim }]}>{t("home.freezeLink")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.askBarWrap, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable style={styles.askBar} onPress={() => go("voice")}>
          <LinearGradient
            colors={["rgba(37,99,235,0.55)", "rgba(124,58,237,0.35)"]}
            style={styles.askOrb}
          >
            <Text style={styles.askOrbText}>Ξ</Text>
          </LinearGradient>
          <Text style={[styles.askPlaceholder, { color: colors.textDim }]}>
            {t("home.askEphera")}
          </Text>
          <Text style={styles.mic}>🎙</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  pad: { paddingHorizontal: space.lg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: themeColors.danger,
    borderWidth: 1.5,
    borderColor: themeColors.bg,
  },
  frozenBanner: {
    backgroundColor: "rgba(248,113,113,0.12)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    padding: 12,
    marginBottom: space.md,
  },
  frozenText: { color: themeColors.danger, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: space.lg,
  },
  totalLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  totalLabel: { color: themeColors.textMuted, fontSize: 13 },
  eye: { fontSize: 12 },
  balance: {
    color: themeColors.text,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  usd: {
    color: themeColors.textDim,
    fontSize: 13,
    marginTop: 4,
  },
  greeting: {
    color: themeColors.textDim,
    fontSize: 12,
    marginTop: 8,
    textTransform: "capitalize",
  },
  accountsChip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    marginTop: 4,
  },
  accountsText: { color: themeColors.textMuted, fontSize: 11, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.lg,
    paddingHorizontal: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  txName: { color: themeColors.text, fontWeight: "600", fontSize: 14 },
  txMeta: { color: themeColors.textDim, fontSize: 11, marginTop: 2 },
  txAmount: { fontWeight: "700", fontSize: 14 },
  txTag: { color: themeColors.success, fontSize: 10, marginTop: 2 },
  freezeLink: { marginTop: space.md, alignItems: "center" },
  freezeText: { color: themeColors.textDim, fontSize: 12 },
  askBarWrap: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
  },
  askBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 29, 50, 0.55)",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderColor: "rgba(147,197,253,0.32)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  askOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  askOrbText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  askPlaceholder: { flex: 1, color: themeColors.textDim, fontSize: 13 },
  mic: { fontSize: 14 },
});
