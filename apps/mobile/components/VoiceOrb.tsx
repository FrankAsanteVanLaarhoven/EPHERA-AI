import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

type Props = {
  size?: number;
  listening?: boolean;
  /** Brand monogram — mockup uses stacked-E mark */
  mark?: "ephera" | "bars";
  style?: ViewStyle;
  showWaves?: boolean;
};

/** Premium multi-ring EPHERA orb matching product benchmark UI. */
export function VoiceOrb({
  size = 160,
  listening = false,
  mark = "ephera",
  style,
  showWaves = true,
}: Props) {
  const s = size;
  return (
    <View style={[{ width: s * 1.55, height: s * 1.2, alignItems: "center", justifyContent: "center" }, style]}>
      {/* Horizontal sound waves */}
      {showWaves ? (
        <>
          <View style={[styles.wave, { width: s * 1.45, height: s * 0.55, opacity: listening ? 0.55 : 0.28 }]} />
          <View style={[styles.wave, { width: s * 1.25, height: s * 0.4, opacity: listening ? 0.4 : 0.18 }]} />
        </>
      ) : null}

      {/* Outer glow disc */}
      <LinearGradient
        colors={
          listening
            ? ["rgba(34,211,238,0.35)", "rgba(59,130,246,0.12)", "transparent"]
            : ["rgba(59,130,246,0.4)", "rgba(29,78,216,0.15)", "transparent"]
        }
        style={[
          styles.glow,
          {
            width: s * 1.15,
            height: s * 1.15,
            borderRadius: (s * 1.15) / 2,
          },
        ]}
      />

      {/* Outer ring */}
      <View
        style={[
          styles.ring,
          {
            width: s,
            height: s,
            borderRadius: s / 2,
            borderColor: listening ? "rgba(34,211,238,0.65)" : "rgba(96,165,250,0.55)",
          },
        ]}
      />

      {/* Mid ring */}
      <View
        style={[
          styles.ringMid,
          {
            width: s * 0.82,
            height: s * 0.82,
            borderRadius: (s * 0.82) / 2,
            borderColor: listening ? "rgba(139,92,246,0.5)" : "rgba(59,130,246,0.35)",
          },
        ]}
      />

      {/* Core */}
      <LinearGradient
        colors={["#2563EB", "#1D4ED8", "#1E3A8A"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[
          styles.core,
          {
            width: s * 0.52,
            height: s * 0.52,
            borderRadius: (s * 0.52) / 2,
          },
        ]}
      >
        {mark === "bars" ? (
          <View style={styles.bars}>
            <View style={[styles.bar, { height: 10 }]} />
            <View style={[styles.bar, { height: 16 }]} />
            <View style={[styles.bar, { height: 12 }]} />
          </View>
        ) : (
          <View style={styles.monoWrap}>
            <Text style={[styles.mono, { fontSize: s * 0.14 }]}>E</Text>
            <View style={styles.monoLines}>
              <View style={styles.monoLine} />
              <View style={styles.monoLine} />
              <View style={styles.monoLine} />
            </View>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    backgroundColor: "rgba(8, 15, 35, 0.35)",
  },
  ringMid: {
    position: "absolute",
    borderWidth: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  core: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.45)",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.7,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  monoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  mono: {
    color: colors.white,
    fontWeight: "200",
    letterSpacing: 1,
  },
  monoLines: {
    gap: 2.5,
    justifyContent: "center",
  },
  monoLine: {
    width: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  bars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  wave: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "rgba(56, 189, 248, 0.35)",
    backgroundColor: "transparent",
  },
});
