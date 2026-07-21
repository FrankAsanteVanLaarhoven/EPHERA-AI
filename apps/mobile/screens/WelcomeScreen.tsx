import { StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { Chip, PrimaryButton, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

export default function WelcomeScreen({ go }: { go: (screen: Route) => void }) {
  return (
    <Screen style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>◆</Text>
          <Text style={styles.badgeText}>VOICE FIRST</Text>
        </View>
        <Text style={styles.lang}>🌐  EN ▾</Text>
      </View>

      <Text style={styles.greeting}>Good morning</Text>
      <Text style={styles.question}>
        How can I help you{"\n"}today?
      </Text>

      <View style={styles.orbWrap}>
        <VoiceOrb size={170} mark="bars" />
        <Text style={styles.hint}>Tap to speak or say “Hey Ephera”</Text>
      </View>

      <View style={styles.chips}>
        <Chip icon="🛡" label={"Secure\nBank-grade"} />
        <Chip icon="🔒" label={"Private\nYour data, yours"} />
        <Chip icon="⚡" label={"Instant\nReal-time"} />
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
  root: { justifyContent: "flex-start" },
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
    backgroundColor: "rgba(37,99,235,0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
  },
  badgeIcon: { color: colors.cyan, fontSize: 9 },
  badgeText: {
    color: colors.accentBright,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  lang: { color: colors.textMuted, fontSize: 13 },
  greeting: {
    color: colors.textMuted,
    fontSize: 20,
    marginTop: 4,
  },
  question: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
    marginTop: 4,
  },
  orbWrap: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 18,
  },
  hint: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 13,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  actions: {
    marginTop: "auto",
    paddingBottom: 4,
  },
});
