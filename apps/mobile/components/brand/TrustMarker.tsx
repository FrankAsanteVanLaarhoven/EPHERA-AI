import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../lib/theme-context";

export type TrustKind =
  | "verifiedRecipient"
  | "regulatedProvider"
  | "protectedBalance"
  | "secureDevice"
  | "passkey"
  | "feeDisclosed"
  | "rateLocked"
  | "railSelected"
  | "recipientConfirmed"
  | "reversible"
  | "irreversible"
  | "settled";

const LABELS: Record<TrustKind, { icon: string; label: string; tone: "ok" | "info" | "warn" | "danger" }> = {
  verifiedRecipient: { icon: "✓", label: "Verified recipient", tone: "ok" },
  regulatedProvider: { icon: "⚖", label: "Regulated provider", tone: "info" },
  protectedBalance: { icon: "🛡", label: "Protected balance", tone: "ok" },
  secureDevice: { icon: "⬚", label: "Secure device", tone: "info" },
  passkey: { icon: "🔑", label: "Passkey protected", tone: "ok" },
  feeDisclosed: { icon: "◎", label: "Fee fully disclosed", tone: "info" },
  rateLocked: { icon: "⛓", label: "Exchange rate locked", tone: "info" },
  railSelected: { icon: "⇢", label: "Payment rail selected", tone: "info" },
  recipientConfirmed: { icon: "✓", label: "Recipient confirmation", tone: "ok" },
  reversible: { icon: "↺", label: "Reversible action", tone: "info" },
  irreversible: { icon: "!", label: "Irreversible action", tone: "warn" },
  settled: { icon: "●", label: "Settlement completed", tone: "ok" },
};

/**
 * Explicit trust marker — beauty never replaces disclosure.
 */
export function TrustMarker({ kind }: { kind: TrustKind }) {
  const { colors } = useTheme();
  const meta = LABELS[kind];
  const tone =
    meta.tone === "ok"
      ? colors.success
      : meta.tone === "warn"
        ? colors.warning
        : meta.tone === "danger"
          ? colors.danger
          : colors.accentBright;

  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: `${tone}55`,
          backgroundColor: `${tone}14`,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={meta.label}
    >
      <Text style={{ color: tone, fontSize: 11, fontWeight: "700" }}>{meta.icon}</Text>
      <Text style={{ color: tone, fontSize: 11, fontWeight: "600" }}>{meta.label}</Text>
    </View>
  );
}

export function TrustRow({ kinds }: { kinds: TrustKind[] }) {
  return (
    <View style={styles.row}>
      {kinds.map((k) => (
        <TrustMarker key={k} kind={k} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
