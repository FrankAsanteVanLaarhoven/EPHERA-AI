import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { NeonLogo } from "../components/brand/NeonLogo";
import { space, typography } from "../theme";
import type { Screen } from "../App";

export default function SplashScreen({ go }: { go: (screen: Screen) => void }) {
  const { colors, isDark, mood } = useTheme();
  const t = useT();

  return (
    <Pressable style={styles.root} onPress={() => go("welcome")}>
      {/* Deep stage so the tube light reads — light mode still uses dark navy stage for brand splash */}
      <LinearGradient
        colors={
          isDark
            ? ["#010308", "#050B18", "#07122A", "#02060F"]
            : ["#0A1628", "#0C1A32", "#0E2040", "#0A1628"]
        }
        style={StyleSheet.absoluteFill}
      />
      {/* Mood-coloured ambient bloom behind the mark */}
      <LinearGradient
        colors={[`${mood.halo}33`, `${mood.halo}08`, "transparent"]}
        style={styles.bloom}
      />
      <LinearGradient
        colors={["transparent", "rgba(37,99,235,0.14)", "rgba(14,165,233,0.08)"]}
        style={styles.horizon}
      />

      <View style={styles.hero}>
        {/* Official stacked mark with silhouette-matched neon tube + pulse */}
        <NeonLogo
          layout="stacked"
          intensity="tube"
          pulse
          size={isDark ? 168 : 160}
          plate={false}
        />
      </View>

      <View style={styles.bottom}>
        <Text
          style={[
            styles.headline,
            {
              color: "#F4F8FF",
              textShadowColor: mood.halo,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 10,
            },
          ]}
        >
          {t("splash.headline")}
        </Text>
        <Text style={[styles.sub, { color: "rgba(244,248,255,0.55)" }]}>
          {t("splash.sub")}
        </Text>
        <Text style={[styles.hint, { color: `${mood.tube}99` }]}>Tap to continue</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050B18",
  },
  bloom: {
    position: "absolute",
    top: "18%",
    left: "8%",
    right: "8%",
    height: "42%",
    borderRadius: 999,
  },
  horizon: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "42%",
  },
  hero: {
    alignItems: "center",
    marginTop: -24,
  },
  bottom: {
    position: "absolute",
    bottom: 72,
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  headline: {
    fontSize: typography.subtitle,
    fontWeight: "600",
    letterSpacing: 0.2,
    fontFamily: "System",
  },
  sub: {
    marginTop: 8,
    fontSize: typography.caption,
    fontFamily: "System",
  },
  hint: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
