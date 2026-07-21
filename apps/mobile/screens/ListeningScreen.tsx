import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VoiceOrb } from "../components/VoiceOrb";
import { VoicePrivacySignal } from "../components/brand/VoicePrivacySignal";
import { GlassCard, GlassIconButton, IconWell } from "../components/ui";
import { parseVoiceUtterance } from "../lib/api";
import { brandHaptic } from "../lib/brand-system/haptics";
import { brandSonic } from "../lib/brand-system/sonic";
import type { SymbolState } from "../lib/brand-system/tokens";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { colors as themeColors, radii, space } from "../theme";
import type { Screen as Route } from "../lib/navigation";

const SUGGESTION_DEFS = [
  {
    icon: "send" as const,
    labelKey: "listening.suggestSend",
    action: "send" as const,
    intent: true,
  },
  { icon: "wallet" as const, labelKey: "listening.suggestBalance", action: "home" as const },
  { icon: "tv" as const, labelKey: "listening.suggestDstv", action: "bills" as const },
  { icon: "insights" as const, labelKey: "listening.suggestTx", action: "activity" as const },
];

type Phase = "listening" | "processing" | "heard";

export default function ListeningScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const t = useT();
  const [phase, setPhase] = useState<Phase>("listening");
  const [heard, setHeard] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const symbolState: SymbolState =
    phase === "listening"
      ? "listeningLocal"
      : phase === "processing"
        ? "cloudProcessing"
        : "confirmation";

  useEffect(() => {
    void brandHaptic("voiceActivated");
    void brandSonic("listening");
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const SUGGESTIONS = SUGGESTION_DEFS.map((s) => ({ ...s, label: t(s.labelKey) }));

  function runSuggestion(s: (typeof SUGGESTIONS)[number]) {
    if (s.action === "send" && s.intent) {
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
      return;
    }
    go(s.action);
  }

  async function simulateUtterance(text: string) {
    setPhase("processing");
    setHeard(text);
    void brandHaptic("intentUnderstood");
    void brandSonic("intentReceived");
    const parsed = await parseVoiceUtterance(text);
    const intent = parsed?.intent;
    if (intent?.name === "send_money" && intent.amount && intent.recipient?.displayName) {
      go("send", {
        intentJson: JSON.stringify({
          id: `voice_${Date.now()}`,
          name: "send_money",
          language: "en",
          confidence: intent.confidence ?? 0.88,
          amount: intent.amount,
          recipient: {
            displayName: intent.recipient.displayName,
            verified: intent.recipient.verified ?? true,
            accountHint: intent.recipient.accountHint ?? "wallet",
          },
          rawUtterance: text,
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }
    // Fallback demo path for known phrases
    const lower = text.toLowerCase();
    if (lower.includes("send") || lower.includes("ama")) {
      runSuggestion(SUGGESTIONS[0]);
      return;
    }
    if (lower.includes("balance")) {
      go("home");
      return;
    }
    setPhase("heard");
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={isDark ? ["#02060F", "#07122A", "#050B18"] : ["#E8EEF7", "#F3F6FB", "#E8EEF7"]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(34,211,238,0.08)", "transparent", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassIconButton iconName="close" onPress={back} size={34} label="Close" />
        <Text style={[styles.topTitle, { color: colors.textMuted }]}>{t("listening.title")}</Text>
        <GlassIconButton iconName="menu" onPress={() => go("servicesDrawer")} size={34} label="Menu" />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.center}>
          <Text style={styles.listening}>
            {phase === "listening"
              ? t("listening.listening")
              : phase === "processing"
                ? t("listening.understanding")
                : t("listening.gotIt")}
          </Text>

          <Animated.View style={{ transform: [{ scale: pulse }], alignItems: "center" }}>
            <Pressable
              onPress={() => void simulateUtterance("Send 100 cedis to Ama")}
              accessibilityRole="button"
              accessibilityLabel="Tap to simulate voice command"
            >
              <VoiceOrb
                size={168}
                listening={phase === "listening"}
                mark="bars"
                symbolState={
                  phase === "listening"
                    ? "listening"
                    : phase === "processing"
                      ? "processing"
                      : "confirmation"
                }
              />
            </Pressable>
            <View style={{ marginTop: 14 }}>
              <VoicePrivacySignal state={symbolState} size={28} />
            </View>
          </Animated.View>

          <Text style={[styles.imListening, { color: colors.text }]}>
            {phase === "listening" ? t("listening.imListening") : heard ?? t("listening.imListening")}
          </Text>
          <Text style={[styles.help, { color: colors.textMuted }]}>
            {phase === "listening"
              ? t("listening.howHelp")
              : phase === "processing"
                ? t("listening.matching")
                : t("listening.trySaying")}
          </Text>
        </View>

        <View style={styles.tryPill}>
          <Text style={[styles.tryPillText, { color: colors.textDim }]}>{t("listening.trySaying")}</Text>
        </View>

        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
          {SUGGESTIONS.map((s, idx) => (
            <Pressable
              key={s.label}
              style={[
                styles.row,
                idx === SUGGESTIONS.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => runSuggestion(s)}
            >
              <IconWell name={s.icon} size={36} tone="tube" />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{s.label}</Text>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          ))}
        </GlassCard>

        <View style={styles.footer}>
          <View style={styles.footerPill}>
            <Text style={[styles.footerText, { color: colors.textDim }]}>
              ◆  Voice proposes · passkey authorises · not a tab
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: 4,
  },
  topTitle: {
    color: themeColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(18,29,50,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  iconBtnText: { color: themeColors.textMuted, fontSize: 15 },
  scroll: {
    paddingHorizontal: space.lg,
  },
  center: { alignItems: "center", marginTop: 12, marginBottom: space.lg },
  listening: {
    color: themeColors.cyan,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  imListening: {
    marginTop: 12,
    color: themeColors.text,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  help: {
    marginTop: 6,
    color: themeColors.textMuted,
    fontSize: 16,
    textAlign: "center",
  },
  tryPill: {
    alignSelf: "center",
    backgroundColor: "rgba(18,29,50,0.95)",
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: themeColors.border,
    marginBottom: 12,
  },
  tryPillText: {
    color: themeColors.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rowIcon: { fontSize: 14 },
  rowLabel: { flex: 1, color: themeColors.text, fontSize: 15, fontWeight: "500" },
  rowChevron: { color: themeColors.textDim, fontSize: 22, fontWeight: "300" },
  footer: {
    marginTop: 24,
    alignItems: "center",
  },
  footerPill: {
    backgroundColor: "rgba(8,15,30,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  footerText: {
    color: themeColors.textDim,
    fontSize: 11,
    fontWeight: "600",
  },
});
