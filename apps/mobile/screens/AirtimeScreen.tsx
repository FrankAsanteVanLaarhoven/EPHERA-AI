import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const NETWORKS = ["MTN", "Vodafone", "AirtelTigo", "Glo"];
const AMOUNTS = ["5", "10", "20", "50", "100"];

export default function AirtimeScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors } = useTheme();
  const [network, setNetwork] = useState("MTN");
  const [forSelf, setForSelf] = useState(true);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("20");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Airtime & data" subtitle="Do not assume the detected number is the recipient" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.toggle}>
          {[
            { id: true, label: "For myself" },
            { id: false, label: "For someone else" },
          ].map((o) => (
            <Pressable
              key={String(o.id)}
              onPress={() => setForSelf(o.id)}
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: forSelf === o.id ? colors.accentSoft : "transparent",
                  borderColor: forSelf === o.id ? colors.borderStrong : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: forSelf === o.id ? colors.accentBright : colors.textMuted,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {!forSelf ? (
          <GlassCard style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.textDim, fontSize: 11, marginBottom: 6 }}>Mobile number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+233 …"
              placeholderTextColor={colors.textDim}
              keyboardType="phone-pad"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
          </GlassCard>
        ) : null}

        <Text style={[styles.sec, { color: colors.textDim }]}>Network</Text>
        <View style={styles.row}>
          {NETWORKS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setNetwork(n)}
              style={[
                styles.chip,
                {
                  borderColor: network === n ? colors.borderStrong : colors.border,
                  backgroundColor: network === n ? colors.accentSoft : "rgba(255,255,255,0.04)",
                },
              ]}
            >
              <Text
                style={{
                  color: network === n ? colors.accentBright : colors.textMuted,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                {n}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sec, { color: colors.textDim }]}>Amount (GHS)</Text>
        <View style={styles.row}>
          {AMOUNTS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAmount(a)}
              style={[
                styles.chip,
                {
                  borderColor: amount === a ? colors.borderStrong : colors.border,
                  backgroundColor: amount === a ? colors.accentSoft : "rgba(255,255,255,0.04)",
                },
              ]}
            >
              <Text
                style={{
                  color: amount === a ? colors.accentBright : colors.textMuted,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {a}
              </Text>
            </Pressable>
          ))}
        </View>

        <GlassCard style={{ marginVertical: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>Also on this page</Text>
          {[
            "Data bundles · compare packages",
            "Automatic top-up",
            "Roaming packs",
            "eSIM marketplace",
            "Family data sharing",
            "Emergency airtime advance (where regulated)",
          ].map((x) => (
            <Text key={x} style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
              · {x}
            </Text>
          ))}
        </GlassCard>

        <PrimaryButton
          label={`Buy GH₵ ${amount} ${network} airtime`}
          onPress={() => go("send")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", gap: 8, marginBottom: 14 },
  toggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sec: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
