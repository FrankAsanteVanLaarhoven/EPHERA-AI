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
import { QrCodeView } from "../components/QrCode";
import { GlassCard, Icon, IconWell, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useProfile } from "../lib/profile";
import { useTheme } from "../lib/theme-context";
import {
  buildPayPayload,
  toHttpsLink,
  toQrValue,
  formatGhsInput,
} from "../lib/paymentLink";
import type { Screen as Route } from "../lib/navigation";
import { radii, space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

export default function MerchantScreen({ go, back }: { go: Go; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { profile } = useProfile();
  const [mode, setMode] = useState<"pay" | "accept">("pay");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("Store sale");

  const merchantId = `m_${profile.handle.replace(/^@/, "")}`;

  const acceptPayload = useMemo(
    () =>
      buildPayPayload({
        to: profile.handle,
        displayName: profile.displayName,
        amount: amount || undefined,
        currency: "GHS",
        note: label,
        kind: "merchant",
        merchantId,
      }),
    [profile, amount, label, merchantId],
  );

  const qrValue = useMemo(() => toQrValue(acceptPayload), [acceptPayload]);
  const link = useMemo(() => toHttpsLink(acceptPayload), [acceptPayload]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Merchant" subtitle="Pay or accept" onBack={back} />
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabs}>
          {(
            [
              ["pay", "Pay a merchant"],
              ["accept", "Accept payment"],
            ] as const
          ).map(([id, t]) => (
            <Pressable
              key={id}
              onPress={() => setMode(id)}
              style={[
                styles.tab,
                {
                  borderColor: mode === id ? colors.borderStrong : colors.border,
                  backgroundColor: mode === id ? colors.accentSoft : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  color: mode === id ? colors.accentBright : colors.textMuted,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "pay" ? (
          <>
            <GlassCard style={{ marginBottom: 12 }}>
              {(
                [
                  { icon: "qr" as const, title: "Scan merchant QR", sub: "Open camera", action: () => go("scan") },
                  { icon: "link" as const, title: "Pay with link", sub: "Paste payment link on Send", action: () => go("send") },
                  { icon: "split" as const, title: "Split payment", sub: "Share amount with friends", action: () => go("receive") },
                  { icon: "refund" as const, title: "Request refund", sub: "Open support case", action: () => go("disputes") },
                ] as const
              ).map((item, i, arr) => (
                <Pressable
                  key={item.title}
                  onPress={item.action}
                  style={[
                    styles.row,
                    i < arr.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <IconWell name={item.icon} size={38} tone="tube" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      {item.sub}
                    </Text>
                  </View>
                  <Icon name="chevron" size={16} color={colors.textDim} />
                </Pressable>
              ))}
            </GlassCard>
            <PrimaryButton label="Scan to pay" iconName="qr" onPress={() => go("scan")} click="tx_scan" />
          </>
        ) : (
          <>
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.textDim }]}>Amount (optional)</Text>
              <View style={styles.amountRow}>
                <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 18 }}>GH₵</Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textDim}
                  style={[styles.amountInput, { color: colors.text }]}
                />
              </View>
              <Text style={[styles.label, { color: colors.textDim, marginTop: 10 }]}>Label</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="What is this sale?"
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

            <View style={{ alignItems: "center", marginVertical: 8 }}>
              <QrCodeView
                value={qrValue}
                size={200}
                label={
                  amount
                    ? `Customer pays ${formatGhsInput(amount)}`
                    : "Customer chooses amount"
                }
              />
            </View>

            <PrimaryButton
              label="Share payment link"
              onPress={() =>
                void Share.share({
                  message: `Pay ${profile.displayName} on Ephera\n${link}`,
                  url: link,
                })
              }
            />
            <View style={{ height: 8 }} />
            <PrimaryButton
              label="Create invoice (demo)"
              variant="secondary"
              onPress={() => go("support")}
            />
            <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 14, lineHeight: 16 }}>
              Business mode adds settlements, staff, stock and supplier payouts after KYB. Refunds always leave a case reference.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: "700", paddingVertical: 4 },
  input: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
