import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PaymentIntent } from "@ephera/intent-schema";
import { validatePaymentIntent } from "@ephera/validation";
import { createPasskeyModule } from "@ephera/passkeys";
import { OfflineQueue, MemoryStorage } from "@ephera/offline-queue";
import { GlassCard, Icon, IconWell, PrimaryButton, type IconName } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { TrustRow } from "../components/brand/TrustMarker";
import { brandHaptic } from "../lib/brand-system/haptics";
import { brandSonic } from "../lib/brand-system/sonic";
import { useTheme } from "../lib/theme-context";
import { PAYMENTS_URL } from "../lib/config";
import { prepareTransfer, requestAuthorisationGrant } from "../lib/api";
import type { Screen as Route } from "../lib/navigation";
import { radii, space } from "../theme";

const passkeys = createPasskeyModule({ allowMock: true });
const offlineQueue = new OfflineQueue(new MemoryStorage());

type Go = (s: Route, p?: Record<string, string>) => void;
type Step = "recipient" | "amount" | "review" | "done";
type Rail = "contact" | "mobile" | "bank" | "momo" | "username" | "qr" | "intl";

const RAILS: { id: Rail; label: string; icon: IconName }[] = [
  { id: "contact", label: "Contact", icon: "contact" },
  { id: "mobile", label: "Mobile", icon: "phone" },
  { id: "bank", label: "Bank", icon: "bank" },
  { id: "momo", label: "MoMo", icon: "momo" },
  { id: "username", label: "Username", icon: "at" },
  { id: "qr", label: "Scan QR", icon: "qr" },
  { id: "intl", label: "Intl", icon: "globe" },
];

const RECENT = [
  { name: "Ama Mensah", hint: "wallet ending 4281", handle: "ama.m" },
  { name: "Nana Kwame", hint: "MTN · ••55 1234", handle: "nana.k" },
  { name: "Kojo Mensah", hint: "GCB · ••8821", handle: "kojo.m" },
];

function formatMoney(minor: number, currency: string) {
  if (currency === "GHS") return `GH₵ ${(minor / 100).toFixed(2)}`;
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function SendScreen({
  go,
  back,
  params,
}: {
  go: Go;
  back: () => void;
  params?: Record<string, string>;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const fromIntent = useMemo(() => {
    if (!params?.intentJson) return null;
    try {
      return JSON.parse(params.intentJson) as PaymentIntent;
    } catch {
      return null;
    }
  }, [params?.intentJson]);

  const [step, setStep] = useState<Step>(fromIntent ? "review" : "recipient");
  const [rail, setRail] = useState<Rail>("contact");
  const [recipientName, setRecipientName] = useState(
    fromIntent?.recipient?.displayName ?? "",
  );
  const [recipientHint, setRecipientHint] = useState(
    fromIntent?.recipient?.accountHint ?? "",
  );
  const [amountStr, setAmountStr] = useState(
    fromIntent?.amount
      ? String(fromIntent.amount.amountMinor / 100)
      : "",
  );
  const [note, setNote] = useState(fromIntent?.rawUtterance ?? "");
  const [feeMinor, setFeeMinor] = useState(0);
  const [route, setRoute] = useState("EPHERA → mobile money");
  const [eta, setEta] = useState("Under 2 minutes");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const amountMinor = Math.round((Number(amountStr) || 0) * 100);

  const intent: PaymentIntent = useMemo(
    () => ({
      id: fromIntent?.id ?? `send_${Date.now()}`,
      name: "send_money",
      language: "en",
      confidence: fromIntent?.confidence ?? 0.95,
      amount: { amountMinor: amountMinor || 0, currency: "GHS" },
      recipient: {
        displayName: recipientName || "Unknown",
        accountHint: recipientHint || rail,
        verified: true,
        isNew: false,
      },
      rawUtterance: note,
      createdAt: new Date().toISOString(),
    }),
    [fromIntent?.id, fromIntent?.confidence, amountMinor, recipientName, recipientHint, rail, note],
  );

  const issues = validatePaymentIntent(intent);

  useEffect(() => {
    if (step !== "review" || amountMinor <= 0) return;
    void (async () => {
      try {
        const res = await fetch(`${PAYMENTS_URL}/v1/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountMinor,
            currency: "GHS",
            rail: "mobile-money-sim",
          }),
        });
        if (res.ok) {
          const q = await res.json();
          setFeeMinor(q.feeMinor ?? 0);
          setRoute(q.routeSummary ?? "EPHERA → mobile money");
          setEta(q.eta ?? "Under 2 minutes");
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, [step, amountMinor]);

  async function authoriseAndSend() {
    if (issues.length > 0 || !intent.amount || !intent.recipient?.displayName) return;
    setBusy(true);
    setStatus(null);
    setReceipt(null);
    void brandHaptic("authorisationRequired");
    void brandSonic("secureAuth");
    try {
      // The transfer is prepared first so the transfer id, recipient account
      // and fee are fixed before anything is authorised. The grant is then
      // bound to exactly those values, so what the user approved is what the
      // ledger posts (ADR 0002).
      //
      // The idempotency key is derived from the intent and the amount, not from
      // the clock. A retry must reuse the same key, otherwise it becomes a
      // second transfer (D-34).
      const prepared = await prepareTransfer({
        amountMinor: intent.amount.amountMinor,
        currency: intent.amount.currency,
        recipientName: intent.recipient.displayName,
        recipientHint: intent.recipient.accountHint,
        idempotencyKey: `idem_${intent.id}_${intent.amount.amountMinor}`,
      });
      if (!prepared) {
        setStatus("Could not prepare the transfer.");
        return;
      }
      const transferId = prepared.transferId;

      // Device authorisation. The mock returns a reference the ledger no longer
      // accepts; it stays here as the user-facing confirmation step until real
      // passkey verification lands (G2-B).
      const auth = await passkeys.authorise({
        transferId,
        amountMinor: prepared.amountMinor,
        currency: prepared.currency,
        recipientName: intent.recipient.displayName,
        challengeSummary: `Send ${formatMoney(prepared.amountMinor, prepared.currency)} to ${intent.recipient.displayName} (fee ${formatMoney(prepared.feeMinor, prepared.currency)})`,
      });
      if (!auth.ok) {
        setStatus(`Authorisation failed: ${auth.error}`);
        return;
      }

      const grant = await requestAuthorisationGrant(prepared);
      if (!grant) {
        setStatus("Authorisation grant refused.");
        return;
      }

      const body = {
        transferId: prepared.transferId,
        amountMinor: prepared.amountMinor,
        currency: prepared.currency,
        recipientName: intent.recipient.displayName,
        recipientHint: intent.recipient.accountHint,
        fromExternalRef: prepared.fromExternalRef,
        toExternalRef: prepared.toExternalRef,
        rail: prepared.rail,
        authorisationRef: grant,
        idempotencyKey: prepared.idempotencyKey,
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
            authorisationRef: grant,
          });
          setStatus(data.error ?? "The transfer was not sent — try again when you are back online.");
          setStep("done");
          return;
        }
        setStatus(`✓ ${data.status ?? "settled"}`);
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
        void brandHaptic("paymentCompleted");
        void brandSonic("success");
        setStep("done");
      } catch {
        offlineQueue.enqueue({
          id: transferId,
          kind: "domestic_transfer",
          payload: body,
          authorisationRef: grant,
        });
        setStatus("Network unavailable — the transfer was not sent. Try again when you are back online.");
        setStep("done");
      }
    } finally {
      setBusy(false);
    }
  }

  function pickRecent(r: (typeof RECENT)[0]) {
    setRecipientName(r.name);
    setRecipientHint(r.hint);
    setRail("contact");
    setStep("amount");
  }

  function onRail(id: Rail) {
    if (id === "qr") {
      go("scan");
      return;
    }
    if (id === "intl") {
      go("crossBorder");
      return;
    }
    setRail(id);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Send"
        subtitle={
          step === "recipient"
            ? "Choose recipient"
            : step === "amount"
              ? "Enter amount"
              : step === "review"
                ? "Review full cost"
                : "Receipt"
        }
        onBack={() => {
          if (step === "amount") setStep("recipient");
          else if (step === "review" && !fromIntent) setStep("amount");
          else if (step === "done") back();
          else back();
        }}
        right={
          <Pressable onPress={() => go("scan")} hitSlop={8}>
            <Text style={{ color: colors.accentBright, fontWeight: "600", fontSize: 13 }}>
              QR
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        <View style={styles.progress}>
          {(["recipient", "amount", "review"] as const).map((s, i) => {
            const active =
              s === step ||
              (step === "done" && true) ||
              (step === "amount" && s === "recipient") ||
              (step === "review" && s !== "review");
            const current = s === step;
            return (
              <View key={s} style={styles.progItem}>
                <View
                  style={[
                    styles.progDot,
                    {
                      backgroundColor: current
                        ? colors.accent
                        : active
                          ? colors.success
                          : colors.border,
                    },
                  ]}
                />
                {i < 2 ? (
                  <View style={[styles.progLine, { backgroundColor: colors.border }]} />
                ) : null}
              </View>
            );
          })}
        </View>

        {step === "recipient" && (
          <>
            <Text style={[styles.sec, { color: colors.textDim }]}>Send to</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rails}
            >
              {RAILS.map((r) => {
                const active = rail === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onRail(r.id)}
                    style={[
                      styles.rail,
                      {
                        borderColor: active
                          ? colors.borderStrong
                          : isDark
                            ? "rgba(255,255,255,0.1)"
                            : colors.border,
                        backgroundColor: active
                          ? colors.accentSoft
                          : isDark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(255,255,255,0.65)",
                      },
                    ]}
                  >
                    <IconWell
                      name={r.icon}
                      size={36}
                      iconSize={18}
                      tone={active ? "accent" : "tube"}
                      rounded={10}
                    />
                    <Text
                      style={{
                        color: active ? colors.accentBright : colors.textMuted,
                        fontSize: 11,
                        fontWeight: "700",
                        marginTop: 8,
                        letterSpacing: 0.2,
                      }}
                      numberOfLines={1}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.textDim }]}>
                {rail === "mobile" || rail === "momo"
                  ? "Mobile number"
                  : rail === "bank"
                    ? "Account number"
                    : rail === "username"
                      ? "Ephera username"
                      : "Name or search"}
              </Text>
              <TextInput
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder={
                  rail === "username"
                    ? "@username"
                    : rail === "mobile" || rail === "momo"
                      ? "+233 …"
                      : "Recipient"
                }
                placeholderTextColor={colors.textDim}
                autoCapitalize={rail === "username" ? "none" : "words"}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.65)",
                  },
                ]}
              />
              {(rail === "bank" || rail === "momo") && (
                <>
                  <Text style={[styles.label, { color: colors.textDim, marginTop: 12 }]}>
                    {rail === "bank" ? "Bank / account hint" : "Network"}
                  </Text>
                  <TextInput
                    value={recipientHint}
                    onChangeText={setRecipientHint}
                    placeholder={rail === "bank" ? "GCB · account" : "MTN / Vodafone / AirtelTigo"}
                    placeholderTextColor={colors.textDim}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.65)",
                      },
                    ]}
                  />
                </>
              )}
            </GlassCard>

            <Text style={[styles.sec, { color: colors.textDim }]}>Recent</Text>
            <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4, marginBottom: 16 }}>
              {RECENT.map((r, i) => (
                <Pressable
                  key={r.name}
                  onPress={() => pickRecent(r)}
                  style={[
                    styles.recent,
                    i < RECENT.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{r.name}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                      {r.hint}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textDim }}>›</Text>
                </Pressable>
              ))}
            </GlassCard>

            <PrimaryButton
              label="Continue"
              disabled={!recipientName.trim()}
              onPress={() => {
                if (!recipientHint) {
                  setRecipientHint(
                    rail === "username"
                      ? `ephera · ${recipientName}`
                      : `${rail} · verified`,
                  );
                }
                setStep("amount");
              }}
            />
          </>
        )}

        {step === "amount" && (
          <>
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>To</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 4 }}>
                {recipientName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {recipientHint || rail}
              </Text>
            </GlassCard>
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.textDim }]}>You send</Text>
              <View style={styles.amountRow}>
                <Text style={{ color: colors.textMuted, fontSize: 22, fontWeight: "600" }}>
                  GH₵
                </Text>
                <TextInput
                  value={amountStr}
                  onChangeText={(t) => setAmountStr(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textDim}
                  style={[styles.amountInput, { color: colors.text }]}
                  autoFocus
                />
              </View>
              <View style={styles.presets}>
                {["20", "50", "100", "200", "500"].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setAmountStr(p)}
                    style={[
                      styles.preset,
                      {
                        borderColor: amountStr === p ? colors.borderStrong : colors.border,
                        backgroundColor:
                          amountStr === p ? colors.accentSoft : "rgba(255,255,255,0.04)",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: amountStr === p ? colors.accentBright : colors.textMuted,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, { color: colors.textDim, marginTop: 12 }]}>Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Optional"
                placeholderTextColor={colors.textDim}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.65)",
                  },
                ]}
              />
            </GlassCard>
            <PrimaryButton
              label="Compare routes & review"
              disabled={amountMinor <= 0}
              onPress={() => setStep("review")}
            />
          </>
        )}

        {(step === "review" || step === "done") && (
          <>
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.textDim }]}>Recipient</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                {intent.recipient?.displayName}
                {intent.recipient?.verified ? "  · verified" : ""}
              </Text>
              {intent.recipient?.accountHint ? (
                <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                  {intent.recipient.accountHint}
                </Text>
              ) : null}

              <Text style={[styles.label, { color: colors.textDim, marginTop: 14 }]}>
                You send
              </Text>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: "700" }}>
                {formatMoney(amountMinor, "GHS")}
              </Text>

              <View style={styles.costGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textDim }]}>Fee</Text>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {formatMoney(feeMinor, "GHS")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textDim }]}>Total debit</Text>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {formatMoney(amountMinor + feeMinor, "GHS")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textDim }]}>ETA</Text>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{eta}</Text>
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textDim, marginTop: 12 }]}>Route</Text>
              <Text style={{ color: colors.textMuted }}>{route}</Text>
            </GlassCard>

            <View style={{ marginBottom: 12 }}>
              <TrustRow
                kinds={
                  step === "done"
                    ? [
                        "verifiedRecipient",
                        "feeDisclosed",
                        "railSelected",
                        "passkey",
                        "settled",
                      ]
                    : [
                        "verifiedRecipient",
                        "feeDisclosed",
                        "railSelected",
                        "passkey",
                        "irreversible",
                      ]
                }
              />
            </View>

            {issues.length > 0 ? (
              <Text style={{ color: colors.warning, marginBottom: 10 }}>
                Validation: {issues.map((i) => i.code).join(", ")}
              </Text>
            ) : (
              <Text style={{ color: colors.success, marginBottom: 10, fontSize: 13 }}>
                Full cost shown · passkey required to release funds
              </Text>
            )}

            {step === "review" && (
              <>
                <PrimaryButton
                  label={busy ? "Authorising…" : "Authorise with passkey"}
                  onPress={() => void authoriseAndSend()}
                  disabled={issues.length > 0 || busy || amountMinor <= 0}
                  click="sec_auth"
                />
                <View style={{ height: 8 }} />
                <PrimaryButton label="Cancel" variant="ghost" onPress={back} />
              </>
            )}

            {busy ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
            ) : null}
            {status ? (
              <Text style={{ color: colors.text, marginTop: 12, lineHeight: 20 }}>{status}</Text>
            ) : null}
            {receipt ? (
              <Text
                style={{
                  color: colors.textMuted,
                  marginTop: 8,
                  fontFamily: "Courier",
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {receipt}
              </Text>
            ) : null}

            {step === "done" && (
              <>
                <View style={{ height: 12 }} />
                <PrimaryButton
                  label="View receipt"
                  variant="secondary"
                  onPress={() =>
                    go("receipt", {
                      name: recipientName,
                      amount: formatMoney(amountMinor, "GHS"),
                      status: "completed",
                    })
                  }
                />
                <View style={{ height: 8 }} />
                <PrimaryButton label="Done" onPress={back} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  progItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  progDot: { width: 10, height: 10, borderRadius: 5 },
  progLine: { flex: 1, height: 2, marginHorizontal: 4 },
  sec: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  rails: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    paddingRight: 8,
  },
  rail: {
    width: 78,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  recent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    paddingVertical: 4,
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  costGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
});
