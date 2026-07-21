import { Pressable, StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { GlassCard, Screen } from "../components/ui";
import { colors, radii, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const SUGGESTIONS = [
  { icon: "✈", label: "Send 100 cedis to Ama", action: "send" as const },
  { icon: "💼", label: "Check my balance", action: "home" as const },
  { icon: "📺", label: "Pay my DSTV bill", action: "services" as const },
  { icon: "↗", label: "Show recent transactions", action: "home" as const },
];

export default function ListeningScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={back} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Pressable onPress={() => go("services")} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>☰</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={styles.listening}>Listening…</Text>
        <VoiceOrb size={176} listening />
        <Text style={styles.imListening}>I’m listening</Text>
        <Text style={styles.help}>How can I help?</Text>
      </View>

      <Text style={styles.try}>Try saying…</Text>
      <GlassCard style={{ paddingVertical: 8 }}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.label}
            style={styles.row}
            onPress={() => {
              if (s.action === "send") {
                go("send", {
                  intentJson: JSON.stringify({
                    id: "voice_suggest",
                    name: "send_money",
                    language: "en",
                    confidence: 0.92,
                    amount: { amountMinor: 10000, currency: "GHS" },
                    recipient: {
                      displayName: "Ama Mensah",
                      verified: true,
                      accountHint: "wallet ending 4281",
                    },
                    createdAt: new Date().toISOString(),
                  }),
                });
              } else {
                go(s.action);
              }
            }}
          >
            <Text style={styles.rowIcon}>{s.icon}</Text>
            <Text style={styles.rowLabel}>{s.label}</Text>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        ))}
      </GlassCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>◆ Voice is powered by Ephera AI</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnText: { color: colors.textMuted, fontSize: 16 },
  center: { alignItems: "center", marginTop: space.md, marginBottom: space.lg },
  listening: {
    color: colors.cyan,
    fontSize: typography.caption,
    fontWeight: "600",
    marginBottom: space.md,
  },
  imListening: {
    marginTop: space.lg,
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: "700",
  },
  help: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: typography.body,
  },
  try: {
    color: colors.textDim,
    fontSize: typography.caption,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: { width: 28, fontSize: 16 },
  rowLabel: { flex: 1, color: colors.text, fontSize: typography.body },
  rowChevron: { color: colors.textDim, fontSize: 20 },
  footer: {
    marginTop: "auto",
    alignItems: "center",
    paddingTop: space.md,
  },
  footerText: {
    color: colors.textDim,
    fontSize: typography.micro,
    backgroundColor: colors.chip,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
});
