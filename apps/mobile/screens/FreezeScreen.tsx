import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { createPasskeyModule } from "@ephera/passkeys";
import { GlassCard, PrimaryButton, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import { PAYMENTS_URL } from "../lib/config";
import type { Screen as Route } from "../App";

const passkeys = createPasskeyModule({ allowMock: true });

export default function FreezeScreen({
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function freeze() {
    setBusy(true);
    setStatus(null);
    try {
      const auth = await passkeys.authorise({
        transferId: `freeze_${Date.now()}`,
        amountMinor: 1,
        currency: "GHS",
        recipientName: "SELF",
        challengeSummary: "Freeze wallet — block outbound transfers",
      });
      if (!auth.ok) {
        setStatus(`Authorisation failed: ${auth.error}`);
        return;
      }
      const res = await fetch(`${PAYMENTS_URL}/v1/wallet/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalRef: "user:demo-self:GHS",
          reason: "user_requested_possible_theft",
          authorisationRef: auth.authorisationRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      setStatus(`${data.message}\nAccount status: ${data.status}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={back}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.kicker}>SECURITY</Text>
      <Text style={styles.title}>Freeze wallet</Text>
      <Text style={styles.body}>
        Immediately blocks outbound transfers. Passkey required — voice alone cannot freeze or
        unfreeze.
      </Text>

      <GlassCard style={{ marginTop: space.lg }}>
        <Text style={styles.cardTitle}>What happens next</Text>
        <Text style={styles.bullet}>• Outbound payments blocked</Text>
        <Text style={styles.bullet}>• Inbound transfers still credit</Text>
        <Text style={styles.bullet}>• Unfreeze requires stronger step-up</Text>
      </GlassCard>

      <View style={{ marginTop: "auto", gap: 10 }}>
        <PrimaryButton
          label={busy ? "Freezing…" : "Freeze with passkey"}
          variant="danger"
          onPress={() => void freeze()}
          disabled={busy}
        />
        <PrimaryButton label="Cancel" variant="ghost" onPress={back} />
      </View>
      {busy ? <ActivityIndicator color={colors.danger} style={{ marginTop: 12 }} /> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.accentBright, fontWeight: "600", marginBottom: space.sm },
  kicker: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: typography.micro,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "700",
    marginTop: 4,
  },
  body: { color: colors.textMuted, marginTop: 8, lineHeight: 21 },
  cardTitle: { color: colors.text, fontWeight: "700", marginBottom: 10 },
  bullet: { color: colors.textMuted, marginBottom: 6, lineHeight: 20 },
  status: { color: colors.text, marginTop: space.md, lineHeight: 22 },
});
