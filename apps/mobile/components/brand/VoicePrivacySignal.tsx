import { StyleSheet, Text, View } from "react-native";
import type { SymbolState } from "../../lib/brand-system/tokens";
import { useTheme } from "../../lib/theme-context";
import { EpheraBars } from "./EpheraBars";

const PRIVACY: Partial<
  Record<
    SymbolState,
    { label: string; tone: "idle" | "local" | "cloud" | "record" | "off" }
  >
> = {
  notListening: { label: "Not listening", tone: "idle" },
  idle: { label: "Not listening", tone: "idle" },
  listeningLocal: { label: "Listening locally", tone: "local" },
  listening: { label: "Listening locally", tone: "local" },
  voiceActivated: { label: "Listening locally", tone: "local" },
  cloudProcessing: { label: "Cloud processing", tone: "cloud" },
  processing: { label: "Cloud processing", tone: "cloud" },
  recordingConsent: { label: "Recording with consent", tone: "record" },
  micDisabled: { label: "Microphone disabled", tone: "off" },
  voiceHistoryOff: { label: "Voice history off", tone: "off" },
};

/**
 * Unmistakable privacy state for EPHERA Voice.
 * User must never be uncertain whether the app is listening.
 */
export function VoicePrivacySignal({
  state = "notListening",
  size = 36,
}: {
  state?: SymbolState;
  size?: number;
}) {
  const { colors } = useTheme();
  const meta = PRIVACY[state] ?? PRIVACY.notListening!;
  const toneColor =
    meta.tone === "local"
      ? colors.accentBright
      : meta.tone === "cloud"
        ? colors.cyan
        : meta.tone === "record"
          ? colors.warning
          : meta.tone === "off"
            ? colors.textDim
            : colors.textMuted;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View
        style={[
          styles.ring,
          {
            borderColor:
              meta.tone === "cloud" ? colors.cyan : "transparent",
            borderWidth: meta.tone === "cloud" ? 1.5 : 0,
          },
        ]}
      >
        <EpheraBars state={state} size={size} />
      </View>
      <View style={[styles.badge, { backgroundColor: `${toneColor}22`, borderColor: `${toneColor}66` }]}>
        <View style={[styles.dot, { backgroundColor: toneColor }]} />
        <Text style={{ color: toneColor, fontSize: 11, fontWeight: "700" }}>
          {meta.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10 },
  ring: {
    padding: 10,
    borderRadius: 999,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
