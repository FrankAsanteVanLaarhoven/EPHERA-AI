import { StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { Chip, PrimaryButton, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

export default function WelcomeScreen({
  go,
}: {
  go: (screen: Route) => void;
}) {
  return (
    <Screen style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeDot}>◆</Text>
          <Text style={styles.badgeText}>VOICE FIRST</Text>
        </View>
        <Text style={styles.lang}>🌐 EN ▾</Text>
      </View>

      <Text style={styles.greeting}>Good morning</Text>
      <Text style={styles.question}>How can I help you{"\n"}today?</Text>

      <View style={styles.orbWrap}>
        <VoiceOrb size={168} />
        <Text style={styles.hint}>Tap to speak or say “Hey Ephera”</Text>
      </View>

      <View style={styles.chips}>
        <Chip icon="🛡" label="Secure  Bank-grade" />
        <Chip icon="🔒" label="Private  Your data, yours" />
        <Chip icon="⚡" label="Instant  Real-time" />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Sign in to continue" onPress={() => go("home")} />
        <View style={{ height: 12 }} />
        <PrimaryButton
          label="Face ID / Passkey"
          icon="⬚"
          variant="secondary"
          onPress={() => go("home")}
        />
        <PrimaryButton
          label="Other sign in options"
          variant="ghost"
          onPress={() => go("home")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "flex-start",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.lg,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  badgeDot: { color: colors.cyan, fontSize: 10 },
  badgeText: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  lang: { color: colors.textMuted, fontSize: 13 },
  greeting: {
    color: colors.textMuted,
    fontSize: typography.subtitle,
    marginTop: space.sm,
  },
  question: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: "700",
    lineHeight: 40,
    marginTop: 4,
  },
  orbWrap: {
    alignItems: "center",
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  hint: {
    marginTop: space.md,
    color: colors.textDim,
    fontSize: typography.caption,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: space.xl,
  },
  actions: {
    marginTop: "auto",
    paddingBottom: space.sm,
  },
});
