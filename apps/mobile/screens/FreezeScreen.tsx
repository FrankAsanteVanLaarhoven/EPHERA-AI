import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, space } from "@ephera/design-tokens";
import { createPasskeyModule } from "@ephera/passkeys";
import { PAYMENTS_URL } from "../lib/config";
import type { Screen } from "../App";

const passkeys = createPasskeyModule({ allowMock: true });

export default function FreezeScreen({
  back,
}: {
  go: (screen: Screen, params?: Record<string, string>) => void;
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
    <View style={styles.container}>
      <Pressable onPress={back}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.kicker}>SECURITY</Text>
      <Text style={styles.title}>Freeze wallet</Text>
      <Text style={styles.body}>
        Immediately blocks outbound transfers from this wallet. Passkey required. Voice alone cannot
        freeze or unfreeze.
      </Text>
      <Pressable style={[styles.btn, busy && styles.disabled]} disabled={busy} onPress={() => void freeze()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Freeze with passkey</Text>}
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: space.lg, paddingTop: 56 },
  back: { color: colors.accent, marginBottom: space.md, fontWeight: "600" },
  kicker: { color: colors.danger, fontWeight: "700" },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 8 },
  body: { color: colors.textMuted, marginTop: space.sm, lineHeight: 20 },
  btn: {
    marginTop: space.xl,
    backgroundColor: colors.danger,
    borderRadius: 999,
    padding: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },
  status: { color: colors.text, marginTop: space.lg, lineHeight: 22 },
});
