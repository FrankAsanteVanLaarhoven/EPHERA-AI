import { StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { PrimaryButton, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const POINTS = [
  "Hands-free",
  "Faster",
  "Smarter",
  "100% Secure",
];

export default function VoiceModeScreen({
  go,
}: {
  go: (screen: Route) => void;
}) {
  return (
    <Screen style={styles.root}>
      <Text style={styles.title}>Ephera Voice Mode</Text>
      <Text style={styles.info}>ⓘ</Text>

      <View style={styles.orbWrap}>
        <VoiceOrb size={180} listening mark="Ξ" />
      </View>

      <Text style={styles.lead}>
        From now on, interact with Ephera{"\n"}using only your voice.
      </Text>

      <View style={styles.list}>
        {POINTS.map((p) => (
          <View key={p} style={styles.row}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.point}>{p}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottom}>
        <PrimaryButton
          label="Got it, let's go"
          icon="🎙"
          onPress={() => go("listening")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center" },
  title: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: "700",
    alignSelf: "center",
  },
  info: {
    position: "absolute",
    right: space.lg,
    top: 56,
    color: colors.textDim,
    fontSize: 18,
  },
  orbWrap: { marginTop: space.xxl, marginBottom: space.xl },
  lead: {
    color: colors.text,
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: space.xl,
  },
  list: { alignSelf: "stretch", paddingHorizontal: space.xl, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  check: {
    color: colors.success,
    fontSize: 16,
    fontWeight: "700",
    width: 22,
  },
  point: { color: colors.text, fontSize: typography.body, fontWeight: "600" },
  bottom: {
    marginTop: "auto",
    alignSelf: "stretch",
    paddingBottom: space.sm,
  },
});
