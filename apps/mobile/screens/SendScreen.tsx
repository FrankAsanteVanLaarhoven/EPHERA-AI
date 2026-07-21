import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PaymentIntent } from "@ephera/intent-schema";
import { validatePaymentIntent } from "@ephera/validation";
import { createPasskeyModule } from "@ephera/passkeys";
import { OfflineQueue, MemoryStorage } from "@ephera/offline-queue";
import { GlassCard, PrimaryButton, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import { PAYMENTS_URL } from "../lib/config";
import type { Screen as Route } from "../App";

const passkeys = createPasskeyModule({ allowMock: true });
const offlineQueue = new OfflineQueue(new MemoryStorage());

function formatMoney(minor: number, currency: string) {
  if (currency === "GHS") return `GH₵ ${(minor / 100).toFixed(2)}`;
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function SendScreen({
  back,
  params,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
  params?: Record<string, string>;
}) {
  const intent: PaymentIntent = useMemo(() => {
    if (params?.intentJson) {
      try {
        return JSON.parse(params.intentJson) as PaymentIntent;
      } catch {
        /* fallthrough */
      }
    }
    return {
      id: "intent_demo_001",
      name: "send_money",
      language: "en",
      confidence: 0.92,
      amount: { amountMinor: 10000, currency: "GHS" },
      recipient: {
        displayName: "Ama Mensah",
        accountHint: "wallet ending 4281",
        verified: true,
        isNew: false,
      },
      rawUtterance: "Send 100 cedis to Ama",
      createdAt: new Date().toISOString(),
    };
  }, [params?.intentJson]);

  const issues = validatePaymentIntent(intent);
  const [feeMinor, setFeeMinor] = useState(0);
  const [route, setRoute] = useState("EPHERA → mobile money");
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
          body: JSON.stringify({ amountMinor: amount, currency, rail: "mobile-money-sim" }),
        });
        if (res.ok) {
          const q = await res.json();
          setFeeMinor(q.feeMinor ?? 0);
          setRoute(q.routeSummary ?? route);
          setEta(q.eta ?? eta);
        }
      } catch {
        /* keep defaults */
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
        idempotencyKey: `idem_${intent.id}_${Date.now()}`,
      };
      try {
        const res = await fetch(`${PAYMENTS_URL}/v1/transfers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok && data.status !== "settled") {
          offlineQueue.enqueue({
            id: transferId,
            kind: "domestic_transfer",
            payload: body,
            authorisationRef: auth.authorisationRef,
          });
          setStatus(data.error ?? "Queued offline as pending.");
          return;
        }
        setStatus(`✓ ${data.status}`);
        setReceipt(
          [
            data.transferId && `Transfer ${data.transferId}`,
            data.journalEntryId && `Journal ${data.journalEntryId}`,
            data.receiptId && `Receipt ${data.receiptId}`,
            data.message,
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
        setStatus("Network unavailable — authorised transfer queued offline.");
      }
    } finally {
      setBusy(false);
    }
  }

  const amountLabel = intent.amount
    ? formatMoney(intent.amount.amountMinor, intent.amount.currency)
    : "—";

  return (
    <Screen>
      <Pressable onPress={back} style={styles.backRow}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.kicker}>SEND MONEY</Text>
      <Text style={styles.title}>Confirm transfer</Text>
      <Text style={styles.sub}>
        Review recipient, cost and consequence — then authorise with passkey.
      </Text>

      <GlassCard style={{ marginTop: space.lg }}>
        <Text style={styles.label}>Recipient</Text>
        <Text style={styles.value}>
          {intent.recipient?.displayName ?? "Unknown"}
          {intent.recipient?.verified ? "  · verified" : ""}
        </Text>
        {intent.recipient?.accountHint ? (
          <Text style={styles.muted}>{intent.recipient.accountHint}</Text>
        ) : null}

        <Text style={[styles.label, styles.mt]}>You send</Text>
        <Text style={styles.amount}>{amountLabel}</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fee</Text>
            <Text style={styles.valueSm}>
              {formatMoney(feeMinor, intent.amount?.currency ?? "GHS")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ETA</Text>
            <Text style={styles.valueSm}>{eta}</Text>
          </View>
        </View>

        <Text style={[styles.label, styles.mt]}>Route</Text>
        <Text style={styles.muted}>{route}</Text>
      </GlassCard>

      {issues.length > 0 ? (
        <Text style={styles.warn}>Validation: {issues.map((i) => i.code).join(", ")}</Text>
      ) : (
        <Text style={styles.ok}>Voice proposed · passkey required to release funds</Text>
      )}

      <View style={{ marginTop: "auto", gap: 10 }}>
        <PrimaryButton
          label={busy ? "Authorising…" : "Authorise with passkey"}
          onPress={() => void authoriseAndSend()}
          disabled={issues.length > 0 || busy}
        />
        <PrimaryButton label="Cancel" variant="ghost" onPress={back} />
      </View>

      {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} /> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {receipt ? <Text style={styles.receipt}>{receipt}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { marginBottom: space.sm },
  back: { color: colors.accentBright, fontWeight: "600" },
  kicker: {
    color: colors.cyan,
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
  sub: { color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  label: { color: colors.textDim, fontSize: 12, marginBottom: 4 },
  value: { color: colors.text, fontSize: 18, fontWeight: "700" },
  valueSm: { color: colors.text, fontSize: 15, fontWeight: "600" },
  amount: { color: colors.text, fontSize: 32, fontWeight: "700", marginBottom: 8 },
  muted: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  mt: { marginTop: space.md },
  row: { flexDirection: "row", gap: 16, marginTop: space.md },
  warn: { color: colors.warning, marginTop: space.md },
  ok: { color: colors.success, marginTop: space.md, fontSize: 13 },
  status: { color: colors.text, marginTop: space.md, lineHeight: 20 },
  receipt: {
    color: colors.textMuted,
    marginTop: 8,
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 18,
  },
});
