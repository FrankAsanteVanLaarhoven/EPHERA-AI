import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { PaymentIntent } from "@ephera/intent-schema";
import { validatePaymentIntent } from "@ephera/validation";
import { colors, space } from "@ephera/design-tokens";
import { createPasskeyModule } from "@ephera/passkeys";
import { OfflineQueue, MemoryStorage } from "@ephera/offline-queue";
import { PAYMENTS_URL } from "../lib/config";

const passkeys = createPasskeyModule({ allowMock: true });
const offlineQueue = new OfflineQueue(new MemoryStorage());

function formatMoney(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function SendScreen() {
  const params = useLocalSearchParams<{ intentJson?: string }>();
  const intent: PaymentIntent = useMemo(() => {
    if (params.intentJson) {
      try {
        return JSON.parse(String(params.intentJson)) as PaymentIntent;
      } catch {
        /* fall through */
      }
    }
    return {
      id: "intent_demo_001",
      name: "send_money",
      language: "en",
      confidence: 0.92,
      amount: { amountMinor: 5000, currency: "GHS" },
      recipient: {
        displayName: "Ama Mensah",
        accountHint: "wallet ending 4281",
        verified: true,
        isNew: false,
      },
      rawUtterance: "Send 50 cedis to Ama",
      createdAt: new Date().toISOString(),
    };
  }, [params.intentJson]);

  const issues = validatePaymentIntent(intent);
  const [feeMinor, setFeeMinor] = useState(0);
  const [route, setRoute] = useState("EPHERA sandbox → mobile money sim");
  const [eta, setEta] = useState("Under 2 minutes");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  useEffect(() => {
    const amount = intent.amount?.amountMinor ?? 0;
    const currency = intent.amount?.currency ?? "GHS";
    void (async () => {
      try {
        const res = await fetch(`${PAYMENTS_URL}/v1/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountMinor: amount,
            currency,
            rail: "mobile-money-sim",
          }),
        });
        if (res.ok) {
          const q = await res.json();
          setFeeMinor(q.feeMinor ?? 0);
          setRoute(q.routeSummary ?? route);
          setEta(q.eta ?? eta);
        }
      } catch {
        /* offline quote fallback already set */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent.id]);

  async function authoriseAndSend() {
    if (issues.length > 0 || !intent.amount || !intent.recipient?.displayName) return;
    setBusy(true);
    setStatus(null);
    setReceipt(null);
    try {
      const transferId = `tx_local_${Date.now()}`;
      const auth = await passkeys.authorise({
        transferId,
        amountMinor: intent.amount.amountMinor,
        currency: intent.amount.currency,
        recipientName: intent.recipient.displayName,
        challengeSummary: `Send ${formatMoney(intent.amount.amountMinor, intent.amount.currency)} to ${intent.recipient.displayName}`,
      });
      if (!auth.ok) {
        setStatus(`Authorisation failed: ${auth.error}`);
        return;
      }

      const body = {
        amountMinor: intent.amount.amountMinor,
        currency: intent.amount.currency,
        recipientName: intent.recipient.displayName,
        recipientHint: intent.recipient.accountHint,
        rail: "mobile-money-sim",
        authorisationRef: auth.authorisationRef,
        idempotencyKey: `idem_${intent.id}_${intent.amount.amountMinor}`,
      };

      try {
        const res = await fetch(`${PAYMENTS_URL}/v1/transfers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.status === 401 || data.error === "authorisation_required") {
          setStatus("Server rejected: authorisation required (voice is never enough).");
          return;
        }
        if (!res.ok && data.status !== "settled") {
          // Queue for offline retry when network/worker unavailable
          offlineQueue.enqueue({
            id: transferId,
            kind: "domestic_transfer",
            payload: body,
            authorisationRef: auth.authorisationRef,
          });
          setStatus(
            `Could not complete online (${data.error ?? res.status}). Queued offline as pending until revalidated.`,
          );
          return;
        }
        setStatus(`Status: ${data.status}`);
        setReceipt(
          [
            `Transfer ${data.transferId}`,
            `Receipt ${data.receiptId ?? "—"}`,
            data.routeSummary ?? route,
            data.message ?? "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch {
        offlineQueue.enqueue({
          id: transferId,
          kind: "domestic_transfer",
          payload: body,
          authorisationRef: auth.authorisationRef,
        });
        setStatus("Network unavailable. Authorised transfer queued offline (pending, not settled).");
      }
    } finally {
      setBusy(false);
    }
  }

  const amountLabel = intent.amount
    ? formatMoney(intent.amount.amountMinor, intent.amount.currency)
    : "—";

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>SEND MONEY</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Recipient</Text>
        <Text style={styles.value}>
          {intent.recipient?.displayName ?? "Unknown"}
          {intent.recipient?.verified ? " · verified" : ""}
        </Text>
        {intent.recipient?.accountHint ? (
          <Text style={styles.muted}>{intent.recipient.accountHint}</Text>
        ) : null}

        <Text style={[styles.label, styles.mt]}>You send</Text>
        <Text style={styles.value}>{amountLabel}</Text>

        <Text style={[styles.label, styles.mt]}>Fee</Text>
        <Text style={styles.value}>
          {formatMoney(feeMinor, intent.amount?.currency ?? "GHS")}
        </Text>

        <Text style={[styles.label, styles.mt]}>Route</Text>
        <Text style={styles.muted}>{route}</Text>
        <Text style={styles.muted}>{eta}</Text>
      </View>

      {issues.length > 0 ? (
        <Text style={styles.warn}>Validation: {issues.map((i) => i.code).join(", ")}</Text>
      ) : (
        <Text style={styles.ok}>Intent validation passed · passkey required</Text>
      )}

      <Text style={styles.rule}>
        Voice proposed this transfer. Money moves only after passkey + policy + verification.
      </Text>

      <Pressable
        style={[styles.btn, (issues.length > 0 || busy) && styles.btnDisabled]}
        disabled={issues.length > 0 || busy}
        onPress={() => void authoriseAndSend()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Authorise with passkey</Text>
        )}
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {receipt ? <Text style={styles.receipt}>{receipt}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  kicker: { color: colors.accent, fontWeight: "700", marginBottom: space.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderColor: colors.border,
    borderWidth: 1,
    padding: space.md,
  },
  label: { color: colors.textMuted, fontSize: 13 },
  value: { color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 4 },
  muted: { color: colors.textMuted, marginTop: 4 },
  mt: { marginTop: space.md },
  warn: { color: colors.warning, marginTop: space.md },
  ok: { color: colors.success, marginTop: space.md },
  rule: { color: colors.textMuted, marginTop: space.md, lineHeight: 20 },
  btn: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: 999,
    padding: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700" },
  status: { color: colors.text, marginTop: space.md, lineHeight: 20 },
  receipt: {
    color: colors.textMuted,
    marginTop: space.sm,
    lineHeight: 20,
    fontFamily: "Courier",
  },
});
