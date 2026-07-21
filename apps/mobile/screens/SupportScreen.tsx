import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, Icon, IconWell, PrimaryButton, type IconName } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const CHANNELS: { icon: IconName; title: string; sub: string; go: Route; tone?: "tube" | "accent" | "success" | "cyan" }[] = [
  { icon: "chat", title: "Live chat", sub: "Typical reply under 5 min", go: "disputes", tone: "accent" },
  { icon: "call", title: "Voice call", sub: "Local support hours", go: "voice", tone: "success" },
  { icon: "video", title: "Video support", sub: "Complex cases", go: "disputes", tone: "cyan" },
  { icon: "ticket", title: "Track a case", sub: "You always get a case number", go: "disputes" },
];

export default function SupportScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors, mood, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Support" subtitle="Human help when you need it" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        <View style={styles.grid}>
          {CHANNELS.map((c) => (
            <Pressable
              key={c.title}
              onPress={() => go(c.go)}
              style={[
                styles.tile,
                {
                  borderColor: isDark ? mood.edge : colors.border,
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
                },
              ]}
            >
              <IconWell name={c.icon} size={42} tone={c.tone ?? "tube"} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginTop: 10 }}>
                {c.title}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 3 }}>{c.sub}</Text>
            </Pressable>
          ))}
        </View>

        <GlassCard style={{ marginTop: 8 }} halo>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="info" size={16} tube />
            <Text style={{ color: colors.text, fontWeight: "700" }}>Always included</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
            Case number on every dispute · expected response time · escalation path · no dead ends.
          </Text>
        </GlassCard>

        <View style={{ height: 16 }} />
        <PrimaryButton label="Open a dispute" onPress={() => go("disputes")} click="ui_nav" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "47%",
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    minHeight: 120,
  },
});
