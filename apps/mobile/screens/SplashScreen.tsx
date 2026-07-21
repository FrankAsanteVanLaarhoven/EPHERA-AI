import { Pressable, StyleSheet, Text, View } from "react-native";
import { VoiceOrb } from "../components/VoiceOrb";
import { colors, space, typography } from "../theme";
import type { Screen } from "../App";

export default function SplashScreen({
  go,
}: {
  go: (screen: Screen) => void;
}) {
  return (
    <Pressable style={styles.root} onPress={() => go("welcome")}>
      <View style={styles.glow} />
      <VoiceOrb size={200} mark="Ξ" />
      <Text style={styles.brand}>EPHERA</Text>
      <Text style={styles.tag}>MONEY WITHOUT LIMITS</Text>
      <View style={styles.bottom}>
        <Text style={styles.headline}>Voice. Intent. Money.</Text>
        <Text style={styles.sub}>The future of finance is here.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(29, 78, 216, 0.18)",
  },
  brand: {
    marginTop: space.xl,
    color: colors.text,
    fontSize: 42,
    fontWeight: "300",
    letterSpacing: 10,
  },
  tag: {
    marginTop: space.sm,
    color: colors.textDim,
    fontSize: typography.micro,
    letterSpacing: 4,
    fontWeight: "600",
  },
  bottom: {
    position: "absolute",
    bottom: 72,
    alignItems: "center",
  },
  headline: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: "600",
  },
  sub: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: typography.caption,
  },
});
