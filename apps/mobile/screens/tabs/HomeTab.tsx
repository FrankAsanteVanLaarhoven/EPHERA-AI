import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/Avatar";
import { EpheraLogo } from "../../components/EpheraMark";
import {
  GlassActionButton,
  GlassCard,
  GlassIconButton,
  IlluminatedText,
  Screen,
  SectionTitle,
} from "../../components/ui";
import { fetchBalance, formatGhs, formatUsdApprox } from "../../lib/api";
import { useProfile } from "../../lib/profile";
import { useTheme } from "../../lib/theme-context";
import type { Screen as Route, TabId } from "../../lib/navigation";
import { radii, space, type, typography } from "../../theme";

type Go = (screen: Route, params?: Record<string, string>) => void;

const SHORTCUTS = [
  { label: "Send", iconName: "send" as const, go: "send" as const, click: "tx_send" as const },
  { label: "Receive", iconName: "receive" as const, go: "receive" as const, click: "tx_receive" as const },
  { label: "Pay", iconName: "qr" as const, go: "bills" as const, click: "svc_bills" as const },
  { label: "Cash out", iconName: "cashout" as const, go: "payments" as const, click: "tx_cashout" as const },
];

const RECENT = [
  { name: "Ama Mensah", meta: "Today · 9:41", amount: "+ GH₵ 200.00", up: true },
  { name: "MTN Airtime", meta: "Today · 8:15", amount: "- GH₵ 50.00", up: false },
  { name: "ECG Prepaid", meta: "Yesterday", amount: "- GH₵ 180.00", up: false },
];

/**
 * Calm financial overview. No persistent voice branding —
 * voice is only the floating orb.
 */
export default function HomeTab({
  go,
  setTab,
}: {
  go: Go;
  setTab: (t: TabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, mood, isDark } = useTheme();
  const { profile } = useProfile();
  const [balance, setBalance] = useState("GH₵ 12,560.80");
  const [usd, setUsd] = useState("≈ $1,245.60");
  const [hidden, setHidden] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchBalance();
    if (!data) return;
    setBalance(formatGhs(data.availableMinor || data.balanceMinor));
    setUsd(formatUsdApprox(data.availableMinor || data.balanceMinor));
    setAlert(data.status === "frozen" ? "Outgoing payments are frozen." : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 6 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.accentBright}
          />
        }
      >
        <View style={styles.topBar}>
          {/* Original dashboard identity: Ephera mark, top-left */}
          <EpheraLogo
            markSize={32}
            height={28}
            showWord
            variant="crisp"
            onPress={() => go("servicesDrawer")}
          />
          <View style={{ flex: 1 }} />
          <View style={styles.topRight}>
            <GlassIconButton iconName="bell" onPress={() => go("notifications")} size={36} />
            <Avatar size={36} onPress={() => setTab("profile")} />
          </View>
        </View>

        <View style={styles.pad}>
          {alert ? (
            <Pressable style={styles.alert} onPress={() => go("security")}>
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>
                {alert} Tap to manage.
              </Text>
            </Pressable>
          ) : null}

          {/* Total balance — illuminated HUD figure */}
          <Pressable onPress={() => setHidden((h) => !h)}>
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              TOTAL BALANCE  {hidden ? "••" : "○"}
            </Text>
            <IlluminatedText
              tone="tube"
              style={styles.balance}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {hidden ? "GH₵ ••••••" : balance}
            </IlluminatedText>
            <Text style={[styles.usd, { color: colors.textDim }]}>
              {hidden ? "••••" : usd}
            </Text>
          </Pressable>

          <Pressable style={styles.accountsLink} onPress={() => go("accounts")}>
            <Text style={{ color: colors.accentBright, fontSize: 13, fontWeight: "600" }}>
              All accounts →
            </Text>
          </Pressable>

          {/* Quick actions — enterprise icons, glass + tube halo */}
          <View style={styles.actions}>
            {SHORTCUTS.map((s) => (
              <GlassActionButton
                key={s.label}
                iconName={s.iconName}
                label={s.label}
                click={s.click}
                onPress={() => {
                  if (s.go === "payments") setTab("payments");
                  else go(s.go);
                }}
              />
            ))}
          </View>

          {/* Compact cards row */}
          <View style={styles.row}>
            <GlassCard style={styles.half} halo>
              <Text
                style={[
                  styles.cardKicker,
                  {
                    color: isDark ? mood.tube : colors.textDim,
                    textShadowColor: isDark ? mood.halo : "transparent",
                    textShadowRadius: isDark ? 4 : 0,
                    textShadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                Upcoming bill
              </Text>
              <IlluminatedText tone="tube" style={styles.cardTitle} glow={isDark}>
                ECG Prepaid
              </IlluminatedText>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                Due Fri · GH₵ 95
              </Text>
              <Pressable onPress={() => go("bills")} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.accentBright, fontSize: 12, fontWeight: "600" }}>
                  Review →
                </Text>
              </Pressable>
            </GlassCard>
            <GlassCard style={styles.half} halo>
              <Text
                style={[
                  styles.cardKicker,
                  {
                    color: isDark ? mood.tube : colors.textDim,
                    textShadowColor: isDark ? mood.halo : "transparent",
                    textShadowRadius: isDark ? 4 : 0,
                    textShadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                Savings
              </Text>
              <IlluminatedText tone="success" style={styles.cardTitle}>
                Emergency
              </IlluminatedText>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: "62%",
                      backgroundColor: colors.success,
                      shadowColor: colors.success,
                      shadowOpacity: 0.6,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                GH₵ 1,860 / 3,000
              </Text>
            </GlassCard>
          </View>

          <GlassCard style={{ marginTop: 10, paddingVertical: 12 }} halo>
            <View style={styles.fxRow}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>USD / GHS</Text>
              <IlluminatedText tone="tube" style={{ fontWeight: "700", fontSize: 15 }}>
                10.08
              </IlluminatedText>
              <IlluminatedText tone="success" style={{ fontSize: 11, fontWeight: "700" }}>
                +0.12%
              </IlluminatedText>
              <Pressable onPress={() => go("exchange")} style={{ marginLeft: "auto" }}>
                <Text style={{ color: colors.accentBright, fontSize: 12, fontWeight: "600" }}>
                  Convert
                </Text>
              </Pressable>
            </View>
          </GlassCard>

          <View style={{ marginTop: space.lg }}>
            <SectionTitle
              title="Recent"
              action="See all"
              onAction={() => setTab("activity")}
            />
            <GlassCard style={{ paddingVertical: 2 }}>
              {RECENT.map((tx, i) => (
                <Pressable
                  key={tx.name}
                  style={[
                    styles.tx,
                    i < RECENT.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    go("receipt", {
                      name: tx.name,
                      amount: tx.amount,
                    })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isDark ? mood.textGlow : colors.text,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      {tx.name}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                      {tx.meta}
                    </Text>
                  </View>
                  <IlluminatedText
                    tone={tx.up ? "success" : "tube"}
                    style={{ fontWeight: "700", fontSize: 14 }}
                  >
                    {hidden ? "••••" : tx.amount}
                  </IlluminatedText>
                </Pressable>
              ))}
            </GlassCard>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    gap: 10,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pad: { paddingHorizontal: space.lg },
  alert: {
    backgroundColor: "rgba(248,113,113,0.1)",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(248,113,113,0.3)",
    padding: 12,
    marginBottom: 14,
  },
  caption: {
    fontSize: typography.caption,
    fontWeight: "500",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  balance: {
    ...type.balance,
  },
  usd: {
    fontSize: typography.caption,
    marginTop: 4,
    fontWeight: "500",
  },
  accountsLink: { marginTop: 10, marginBottom: space.lg },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1, minHeight: 110 },
  cardKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(148,163,184,0.2)",
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  fxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tx: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
});
