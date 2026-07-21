import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { QrCodeView } from "../components/QrCode";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useProfile } from "../lib/profile";
import { useTheme } from "../lib/theme-context";
import {
  buildPayPayload,
  toDeepLink,
  toHttpsLink,
  toQrValue,
  formatGhsInput,
} from "../lib/paymentLink";
import type { Screen as Route } from "../lib/navigation";
import { radii, space, typography } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const PRESETS = ["50", "100", "200", "500", "1000"];

export default function ReceiveScreen({
  go,
  back,
}: {
  go: Go;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { profile } = useProfile();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"qr" | "details" | "request">("qr");

  const payload = useMemo(
    () =>
      buildPayPayload({
        to: profile.handle,
        displayName: profile.displayName,
        amount: amount || undefined,
        currency: "GHS",
        note: note || undefined,
        kind: "request",
      }),
    [profile.handle, profile.displayName, amount, note],
  );

  const qrValue = useMemo(() => toQrValue(payload), [payload]);
  const httpsLink = useMemo(() => toHttpsLink(payload), [payload]);
  const deepLink = useMemo(() => toDeepLink(payload), [payload]);

  async function shareLink() {
    try {
      await Share.share({
        message: [
          `Pay ${profile.displayName} on Ephera`,
          amount ? `Amount: ${formatGhsInput(amount)}` : null,
          note ? `Note: ${note}` : null,
          httpsLink,
        ]
          .filter(Boolean)
          .join("\n"),
        url: httpsLink,
      });
    } catch {
      /* cancelled */
    }
  }

  async function shareQrText() {
    try {
      await Share.share({
        message: `Ephera pay code:\n${deepLink}`,
      });
    } catch {
      /* cancelled */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Receive"
        subtitle="QR · link · bank · request"
        onBack={back}
        right={
          <Pressable onPress={() => go("scan")} hitSlop={8}>
            <Text style={{ color: colors.accentBright, fontWeight: "600", fontSize: 13 }}>
              Scan
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Avatar size={64} />
          <Text style={[styles.name, { color: colors.text }]}>{profile.displayName}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>{profile.handle}</Text>
        </View>

        {/* Amount first — “Receive exactly GHS 500” */}
        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={[styles.label, { color: colors.textDim }]}>
            Receive exactly (optional)
          </Text>
          <View style={styles.amountRow}>
            <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: "600" }}>GH₵</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textDim}
              style={[styles.amountInput, { color: colors.text }]}
            />
          </View>
          <View style={styles.presets}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setAmount(p)}
                style={[
                  styles.preset,
                  {
                    borderColor: amount === p ? colors.borderStrong : colors.border,
                    backgroundColor:
                      amount === p ? colors.accentSoft : "rgba(255,255,255,0.04)",
                  },
                ]}
              >
                <Text
                  style={{
                    color: amount === p ? colors.accentBright : colors.textMuted,
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
            placeholder="What's this for?"
            placeholderTextColor={colors.textDim}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)",
              },
            ]}
          />
        </GlassCard>

        {/* Mode tabs */}
        <View style={styles.tabs}>
          {(
            [
              ["qr", "QR code"],
              ["details", "Details"],
              ["request", "Request"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[
                styles.tab,
                {
                  borderColor: tab === id ? colors.borderStrong : colors.border,
                  backgroundColor: tab === id ? colors.accentSoft : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  color: tab === id ? colors.accentBright : colors.textMuted,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "qr" && (
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <QrCodeView
              value={qrValue}
              size={210}
              label={
                amount
                  ? `Scan to pay ${formatGhsInput(amount)}`
                  : "Scan to pay any amount"
              }
            />
            <Text
              style={{
                color: colors.textDim,
                fontSize: 11,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {profile.handle} · GHS
            </Text>
            <View style={{ height: 16, width: "100%" }} />
            <PrimaryButton label="Share payment link" icon="↗" onPress={() => void shareLink()} />
            <View style={{ height: 8 }} />
            <PrimaryButton
              label="Share QR payload"
              variant="secondary"
              onPress={() => void shareQrText()}
            />
          </View>
        )}

        {tab === "details" && (
          <GlassCard style={{ marginTop: 8 }}>
            {[
              ["Ephera name", profile.handle],
              ["Display name", profile.displayName],
              ["Currency", "GHS"],
              ["Bank (demo)", "GCB · 00XXXX4281"],
              ["MoMo (demo)", "MTN · ••24 000 0000"],
              ["Payment link", httpsLink],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={{ color: colors.textDim, fontSize: 11, width: "34%" }}>{k}</Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "600",
                    flex: 1,
                    textAlign: "right",
                  }}
                  numberOfLines={3}
                >
                  {v}
                </Text>
              </View>
            ))}
            <View style={{ height: 8 }} />
            <PrimaryButton label="Share bank details" variant="secondary" onPress={() => void shareLink()} />
          </GlassCard>
        )}

        {tab === "request" && (
          <GlassCard style={{ marginTop: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>
              Request money
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
              Creates a payment request QR and link
              {amount ? ` for ${formatGhsInput(amount)}` : ""}. Recipient sees full amount before paying.
            </Text>
            <PrimaryButton
              label={amount ? `Request ${formatGhsInput(amount)}` : "Request any amount"}
              onPress={() => void shareLink()}
            />
            <View style={{ height: 8 }} />
            <PrimaryButton
              label="Split bill (share equally)"
              variant="secondary"
              onPress={() => {
                const half = amount ? (Number(amount) / 2).toFixed(2) : "";
                setAmount(half);
                setNote(note || "Split bill");
              }}
            />
          </GlassCard>
        )}

        <View style={{ height: 16 }} />
        <PrimaryButton label="Done" variant="ghost" onPress={back} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginBottom: space.md },
  name: { fontWeight: "700", fontSize: 18, marginTop: 10 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    paddingVertical: 4,
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 4 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 8,
    alignItems: "flex-start",
  },
});
