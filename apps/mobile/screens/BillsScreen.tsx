import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, Icon, IconWell, type IconName } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const CATS: { icon: IconName; title: string; sub: string; tone?: "tube" | "accent" | "cyan" | "success" | "warning" }[] = [
  { icon: "bolt", title: "Electricity", sub: "ECG, prepaid & postpaid", tone: "warning" },
  { icon: "water", title: "Water", sub: "GWCL & local boards", tone: "cyan" },
  { icon: "wifi", title: "Internet", sub: "Fibre & ISP", tone: "accent" },
  { icon: "tv", title: "Television", sub: "DSTV, GOtv, StarTimes" },
  { icon: "home", title: "Rent", sub: "Scheduled landlord pay" },
  { icon: "school", title: "School fees", sub: "Term & exam fees", tone: "accent" },
  { icon: "building", title: "Government", sub: "Licences & services" },
  { icon: "bus", title: "Transport", sub: "Passes & tolls", tone: "warning" },
  { icon: "shield", title: "Insurance", sub: "Premiums", tone: "success" },
  { icon: "refresh", title: "Subscriptions", sub: "Streaming & software" },
];

const SAVED = [
  { name: "ECG Prepaid · Home", due: "Fri", amount: "GH₵ 95", icon: "bolt" as IconName },
  { name: "DSTV Premium", due: "12 May", amount: "GH₵ 320", icon: "tv" as IconName },
];

export default function BillsScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors, mood, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Bills & utilities" subtitle="Scan, schedule, share household" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sec, { color: colors.textDim }]}>Saved billers</Text>
        {SAVED.map((b) => (
          <GlassCard key={b.name} style={{ marginBottom: 10 }} halo>
            <View style={styles.row}>
              <IconWell name={b.icon} size={40} tone="tube" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{b.name}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3 }}>
                  Due {b.due} · {b.amount}
                </Text>
              </View>
              <Pressable onPress={() => go("send")}>
                <Text style={{ color: colors.accentBright, fontWeight: "600", fontSize: 13 }}>
                  Pay
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        ))}

        <Text style={[styles.sec, { color: colors.textDim, marginTop: 8 }]}>Categories</Text>
        <View style={styles.grid}>
          {CATS.map((c) => (
            <Pressable
              key={c.title}
              onPress={() => go("send")}
              style={[
                styles.tile,
                {
                  borderColor: isDark ? mood.edge : colors.border,
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                },
              ]}
            >
              <IconWell name={c.icon} size={38} tone={c.tone ?? "tube"} rounded={11} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12, marginTop: 10 }}>
                {c.title}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 10, marginTop: 2 }}>{c.sub}</Text>
            </Pressable>
          ))}
        </View>

        <GlassCard style={{ marginTop: 8 }} halo>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="receipt" size={16} tube />
            <Text style={{ color: colors.text, fontWeight: "700" }}>Also available</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
            Scan a bill · Schedule payment · Automatic pay · Low-balance warning · Shared household bills · Digital receipt
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sec: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    minHeight: 100,
  },
});
