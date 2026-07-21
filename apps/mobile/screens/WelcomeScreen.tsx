import { StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { Chip, PrimaryButton, Screen } from "../components/ui";
import { EpheraMark } from "../components/EpheraMark";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { colors as themeColors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

export default function WelcomeScreen({ go }: { go: (screen: Route) => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Screen style={styles.root}>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <EpheraMark size={40} />
      </View>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>◆</Text>
          <Text style={styles.badgeText}>{t("welcome.voiceFirst")}</Text>
        </View>
        <Text style={styles.lang}>🌐  EN ▾</Text>
      </View>

      <Text style={[styles.greeting, { color: colors.textMuted }]}>{t("welcome.greeting")}</Text>
      <Text style={[styles.question, { color: colors.text }]}>
        {t("welcome.question")}
      </Text>

      <View style={styles.orbWrap}>
        <VoiceOrb size={170} mark="bars" />
        <Text style={[styles.hint, { color: colors.textDim }]}>{t("welcome.hint")}</Text>
      </View>

      <View style={styles.chips}>
        <Chip iconName="shield" label={t("welcome.secure")} />
        <Chip iconName="lock" label={t("welcome.private")} />
        <Chip iconName="bolt" label={t("welcome.instant")} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={t("welcome.signIn")} onPress={() => go("home")} variant="tube" />
        <View style={{ height: 12 }} />
        <PrimaryButton
          label={t("welcome.passkey")}
          iconName="passkey"
          variant="secondary"
          onPress={() => go("home")}
        />
        <PrimaryButton
          label={t("welcome.otherSignIn")}
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
  badgeIcon: { color: themeColors.cyan, fontSize: 9 },
  badgeText: {
    color: themeColors.accentBright,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  lang: { color: themeColors.textMuted, fontSize: 13 },
  greeting: {
    color: themeColors.textMuted,
    fontSize: 20,
    marginTop: 4,
  },
  question: {
    color: themeColors.text,
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
    color: themeColors.textDim,
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
