import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors } from "../theme";

type Props = {
  size?: number;
  listening?: boolean;
  mark?: string;
  style?: ViewStyle;
};

const orbShadow = {
  shadowColor: "#3B82F6",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.55,
  shadowRadius: 28,
  elevation: 12,
};

/** Signature EPHERA voice orb — blue/cyan glow with brand mark. */
export function VoiceOrb({ size = 148, listening = false, mark = "Ξ", style }: Props) {
  const outer = size;
  const mid = size * 0.78;
  const core = size * 0.52;

  return (
    <View style={[styles.wrap, { width: outer, height: outer }, style]}>
      <View
        style={[
          styles.ringOuter,
          {
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            opacity: listening ? 0.95 : 0.75,
          },
          orbShadow,
        ]}
      />
      <View
        style={[
          styles.ringMid,
          {
            width: mid,
            height: mid,
            borderRadius: mid / 2,
            borderColor: listening ? colors.cyan : colors.orbRing,
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            width: core,
            height: core,
            borderRadius: core / 2,
          },
        ]}
      >
        <Text style={[styles.mark, { fontSize: core * 0.38 }]}>{mark}</Text>
      </View>
      {listening ? (
        <View style={[styles.waveBar, { width: outer * 0.92, bottom: -6 }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    position: "absolute",
    backgroundColor: "rgba(29, 78, 216, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  ringMid: {
    position: "absolute",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1.5,
  },
  core: {
    backgroundColor: colors.orbCore,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.5)",
  },
  mark: {
    color: colors.white,
    fontWeight: "700",
    letterSpacing: 1,
  },
  waveBar: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(56, 189, 248, 0.45)",
  },
});
