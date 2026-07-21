import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, PrimaryButton } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const CARDS = [
  {
    id: "virt",
    label: "Virtual Visa",
    last4: "4281",
    type: "Virtual",
    bal: "Linked to wallet",
    frozen: false,
    colors: ["#1D4ED8", "#7C3AED"] as const,
  },
  {
    id: "phys",
    label: "Physical Debit",
    last4: "9910",
    type: "Physical",
    bal: "GCB issued",
    frozen: false,
    colors: ["#0F766E", "#115E59"] as const,
  },
];

export default function CardsScreen({ go, back }: { go: Go; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [active, setActive] = useState(CARDS[0].id);
  const [frozen, setFrozen] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const card = CARDS.find((c) => c.id === active)!;
  const isFrozen = frozen[active] ?? card.frozen;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Cards" subtitle="Controls before chrome" onBack={back} />
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {CARDS.map((c) => (
            <Pressable key={c.id} onPress={() => { setActive(c.id); setRevealed(false); }}>
              <LinearGradient
                colors={[...c.colors]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.card,
                  {
                    opacity: active === c.id ? 1 : 0.55,
                    borderWidth: active === c.id ? 1.5 : 0,
                    borderColor: "rgba(255,255,255,0.4)",
                  },
                ]}
              >
                <Text style={styles.cardBrand}>EPHERA</Text>
                <Text style={styles.cardType}>{c.type}</Text>
                <Text style={styles.cardPan}>••••  ••••  ••••  {c.last4}</Text>
                <Text style={styles.cardName}>{c.label}</Text>
                {(frozen[c.id] ?? c.frozen) ? (
                  <Text style={styles.frozenBadge}>FROZEN</Text>
                ) : null}
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>

        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>
            Controls
          </Text>
          {[
            {
              t: isFrozen ? "Unfreeze card" : "Freeze card",
              a: () => setFrozen((f) => ({ ...f, [active]: !isFrozen })),
              danger: !isFrozen,
            },
            { t: revealed ? "Hide details" : "Reveal details securely", a: () => setRevealed((r) => !r) },
            { t: "Spending limits", a: () => go("security") },
            { t: "Restrict countries / merchants", a: () => go("security") },
            { t: "Card transactions", a: () => go("activity") },
            { t: "Report stolen · replace", a: () => go("support") },
          ].map((row, i, arr) => (
            <Pressable
              key={row.t}
              onPress={row.a}
              style={[
                styles.row,
                i < arr.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  color: row.danger ? colors.danger : colors.text,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {row.t}
              </Text>
              <Text style={{ color: colors.textDim }}>›</Text>
            </Pressable>
          ))}
        </GlassCard>

        {revealed ? (
          <GlassCard style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "700" }}>
              DEMO ONLY · never log real PAN
            </Text>
            <Text style={{ color: colors.text, marginTop: 8, fontFamily: "Courier", fontSize: 14 }}>
              4000 00XX XXXX {card.last4}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, fontFamily: "Courier" }}>
              EXP 08/28  CVC •••
            </Text>
          </GlassCard>
        ) : null}

        <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
          Also supported when licensed: single-use, international purchase, merchant-restricted,
          child/dependent, business expense · Apple/Google Wallet on native builds.
        </Text>
        <PrimaryButton label="Order physical card" variant="secondary" onPress={() => go("support")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    height: 168,
    borderRadius: 18,
    padding: 18,
    marginRight: 12,
    justifyContent: "space-between",
  },
  cardBrand: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "200",
    letterSpacing: 3,
    fontSize: 13,
  },
  cardType: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 },
  cardPan: {
    color: "#fff",
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: "600",
    marginTop: 18,
  },
  cardName: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },
  frozenBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    color: "#FECACA",
    fontWeight: "800",
    fontSize: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
});
