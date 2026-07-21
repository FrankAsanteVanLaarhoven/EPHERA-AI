import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createPasskeyModule } from "@ephera/passkeys";
import {
  GlassCard,
  Icon,
  IconWell,
  PrimaryButton,
} from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { fetchBalance, freezeWallet, unfreezeWallet } from "../lib/api";
import { brandHaptic } from "../lib/brand-system/haptics";
import { brandSonic } from "../lib/brand-system/sonic";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

const passkeys = createPasskeyModule({ allowMock: true });

type Go = (s: Route, p?: Record<string, string>) => void;

export default function FreezeScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors, mood, isDark } = useTheme();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const bal = await fetchBalance();
    if (bal) setFrozen(bal.status === "frozen");
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function authoriseAnd(action: "freeze" | "unfreeze") {
    setBusy(true);
    setStatus(null);
    try {
      const auth = await passkeys.authorise({
        transferId: `${action}_${Date.now()}`,
        amountMinor: 1,
        currency: "GHS",
        recipientName: "SELF",
        challengeSummary:
          action === "freeze"
            ? "Freeze wallet — block outbound transfers"
            : "Unfreeze wallet — restore outbound transfers",
      });
      if (!auth.ok) {
        setStatus(`Authorisation failed: ${auth.error}`);
        void brandHaptic("securityWarning");
        void brandSonic("warning");
        return;
      }
      const result =
        action === "freeze"
          ? await freezeWallet(auth.authorisationRef)
          : await unfreezeWallet(auth.authorisationRef);
      if (!result.ok) {
        setStatus(result.message ?? result.error ?? "Request failed");
        void brandHaptic("securityWarning");
        return;
      }
      setFrozen(action === "freeze");
      setStatus(result.message ?? "Done");
      void brandHaptic(action === "freeze" ? "securityWarning" : "paymentCompleted");
      void brandSonic(action === "freeze" ? "warning" : "success");
      await refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={frozen ? "Wallet frozen" : "Freeze wallet"}
        subtitle="Passkey required · voice cannot freeze"
        onBack={back}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: frozen ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.1)",
                  borderColor: frozen ? colors.danger : colors.success,
                },
              ]}
            >
              <IconWell
                name={frozen ? "freeze" : "shield"}
                size={44}
                tone={frozen ? "danger" : "success"}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: frozen ? colors.danger : colors.success,
                    fontWeight: "800",
                    fontSize: 15,
                  }}
                >
                  {frozen ? "OUTBOUND BLOCKED" : "WALLET ACTIVE"}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                  {frozen
                    ? "Outbound transfers blocked. Inbound payments still credit."
                    : "Immediately blocks outbound transfers when frozen."}
                </Text>
              </View>
            </View>

            <GlassCard style={{ marginTop: 14 }} halo>
              <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
                What happens next
              </Text>
              {(
                [
                  { icon: "send" as const, t: "Outbound payments blocked when frozen" },
                  { icon: "receive" as const, t: "Inbound transfers still credit" },
                  { icon: "passkey" as const, t: "Unfreeze requires passkey step-up" },
                  { icon: "shield" as const, t: `Status: ${frozen ? "FROZEN" : "ACTIVE"}` },
                ] as const
              ).map((row) => (
                <View key={row.t} style={styles.bulletRow}>
                  <Icon name={row.icon} size={16} color={mood.tube} />
                  <Text style={{ color: colors.textMuted, flex: 1, lineHeight: 20 }}>{row.t}</Text>
                </View>
              ))}
            </GlassCard>

            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 14, lineHeight: 18 }}>
              Strong authentication is required. Voice alone cannot freeze or unfreeze.
            </Text>

            {status ? (
              <GlassCard style={{ marginTop: 14 }} halo>
                <Text style={{ color: colors.text, lineHeight: 20 }}>{status}</Text>
              </GlassCard>
            ) : null}

            <View style={{ marginTop: 24, gap: 10 }}>
              {!frozen ? (
                <PrimaryButton
                  label={busy ? "Freezing…" : "Freeze with passkey"}
                  variant="danger"
                  iconName="freeze"
                  onPress={() => void authoriseAnd("freeze")}
                  disabled={busy}
                  click="sec_freeze"
                />
              ) : (
                <PrimaryButton
                  label={busy ? "Unfreezing…" : "Unfreeze with passkey"}
                  variant="primary"
                  iconName="passkey"
                  onPress={() => void authoriseAnd("unfreeze")}
                  disabled={busy}
                  click="sec_auth"
                />
              )}
              <PrimaryButton
                label="Open support"
                variant="ghost"
                onPress={() => go("support")}
                click="ui_nav"
              />
              <PrimaryButton label="Done" variant="secondary" onPress={back} click="ui_back" />
            </View>
            {busy ? (
              <ActivityIndicator color={colors.danger} style={{ marginTop: 16 }} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
});
