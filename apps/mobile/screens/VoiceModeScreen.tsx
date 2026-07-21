import { StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { PrimaryButton, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const POINTS = ["Hands-free", "Faster", "Smarter", "100% Secure"];

export default function VoiceModeScreen({ go }: { go: (screen: Route) => void }) {
  return (
    <Screen style={styles.root}>
      <Text style={styles.title}>Ephera Voice Mode</Text>
      <Text style={styles.info}>ⓘ</Text>

      <View style={styles.orbWrap}>
        <VoiceOrb size={186} listening mark="ephera" />
      </View>

      <Text style={styles.lead}>
        From now on, interact with Ephera{"\n"}using only your voice.
      </Text>

      <View style={styles.list}>
        {POINTS.map((p) => (
          <View key={p} style={styles.row}>
            <View style={styles.checkCircle}>
              <Text style={styles.check}>✓</Text>
            </View>
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
    fontSize: 20,
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
  orbWrap: { marginTop: 48, marginBottom: 28 },
  lead: {
    color: colors.text,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  list: { alignSelf: "stretch", paddingHorizontal: 36, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(52,211,153,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: colors.success, fontSize: 13, fontWeight: "800" },
  point: { color: colors.text, fontSize: 16, fontWeight: "600" },
  bottom: {
    marginTop: "auto",
    alignSelf: "stretch",
    paddingBottom: 4,
  },
});
