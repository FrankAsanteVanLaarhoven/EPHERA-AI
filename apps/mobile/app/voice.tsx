import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, space } from "@ephera/design-tokens";
import { VOICE_INTENT_URL } from "../lib/config";

/**
 * Push-to-talk → intent compile → navigate to confirmation panel.
 * Continuous ambient upload while idle is forbidden.
 */
export default function VoiceScreen() {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compileAndRoute(text: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VOICE_INTENT_URL}/v1/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: "en" }),
      });
      if (!res.ok) throw new Error(`Intent service ${res.status}`);
      const data = await res.json();
      if (data.canAuthoriseFromVoiceAlone) {
        throw new Error("Server violated trust rule: voice-only authorisation");
      }
      if (data.needsClarification) {
        setError(
          data.intent?.clarification ??
            "Please clarify amount and recipient. Example: Send 50 cedis to Ama.",
        );
        return;
      }
      if (data.intent?.name === "send_money") {
        router.push({
          pathname: "/send",
          params: {
            intentJson: JSON.stringify(data.intent),
          },
        });
        return;
      }
      if (data.intent?.name === "freeze_wallet") {
        router.push("/freeze");
        return;
      }
      setError(`Intent ${data.intent?.name} recognised (UI later).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function finishListening() {
    setListening(false);
    const text = "Send 50 cedis to Ama";
    setTranscript(text);
    void compileAndRoute(text);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Push-to-talk</Text>
      <Text style={styles.body}>
        Capture intent only. Money still requires passkey authorisation on the confirmation panel.
      </Text>

      <Pressable
        onPressIn={() => {
          setListening(true);
          setTranscript(null);
          setError(null);
        }}
        onPressOut={finishListening}
        style={[styles.mic, listening && styles.micActive]}
      >
        <Text style={styles.micText}>{listening ? "Listening…" : "Hold to talk"}</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setTranscript("Send 50 cedis to Ama");
          void compileAndRoute("Send 50 cedis to Ama");
        }}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Simulate: “Send 50 cedis to Ama”</Text>
      </Pressable>

      {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
      {transcript ? (
        <View style={styles.card}>
          <Text style={styles.label}>Heard (stub STT)</Text>
          <Text style={styles.transcript}>{transcript}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  body: { color: colors.textMuted, marginTop: space.sm, lineHeight: 20 },
  mic: {
    marginTop: space.xl,
    alignSelf: "center",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { backgroundColor: colors.accent },
  micText: { color: colors.text, fontWeight: "700" },
  secondary: { marginTop: space.md, alignItems: "center" },
  secondaryText: { color: colors.accent },
  card: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: space.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  label: { color: colors.textMuted, fontSize: 13 },
  transcript: { color: colors.text, fontSize: 18, fontWeight: "600", marginTop: 6 },
  error: { color: colors.warning, marginTop: space.md, lineHeight: 20 },
});
