import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { VoiceOrb } from "../components/VoiceOrb";
import { colors, space, typography } from "../theme";
import type { Screen } from "../App";

export default function SplashScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <Pressable style={styles.root} onPress={() => go("welcome")}>
      <LinearGradient
        colors={["#02060F", "#07122A", "#050B18"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Planet horizon glow */}
      <LinearGradient
        colors={["transparent", "rgba(37,99,235,0.15)", "rgba(14,165,233,0.08)"]}
        style={styles.horizon}
      />
      <View style={styles.atmosphere} />

      <View style={styles.hero}>
        <VoiceOrb size={210} showWaves={false} />
        <Text style={styles.brand}>EPHERA</Text>
        <Text style={styles.tag}>MONEY WITHOUT LIMITS</Text>
      </View>

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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgDeep,
  },
  horizon: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "42%",
  },
  atmosphere: {
    position: "absolute",
    top: "18%",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  hero: {
    alignItems: "center",
    marginTop: -40,
  },
  brand: {
    marginTop: -8,
    color: colors.text,
    fontSize: 44,
    fontWeight: "200",
    letterSpacing: 12,
  },
  tag: {
    marginTop: 10,
    color: "rgba(148,163,184,0.75)",
    fontSize: 10,
    letterSpacing: 5,
    fontWeight: "600",
  },
  bottom: {
    position: "absolute",
    bottom: 78,
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  headline: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sub: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: typography.caption,
  },
});
