import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SymbolState } from "../lib/brand-system/tokens";
import { useTheme } from "../lib/theme-context";
import { EpheraBars } from "./brand/EpheraBars";

type Props = {
  size?: number;
  listening?: boolean;
  symbolState?: SymbolState;
  mark?: "ephera" | "bars";
  style?: ViewStyle;
  showWaves?: boolean;
};

/** Voice operator HUD — official logo silhouette only, neon tube light. */
export function VoiceOrb({
  size = 160,
  listening = false,
  symbolState,
  mark = "bars",
  style,
  showWaves = true,
}: Props) {
  const { mood, isDark } = useTheme();
  const s = size;
  const liveState: SymbolState =
    symbolState ?? (listening ? "listening" : "idle");
  const tube = mood.tube;

  return (
    <View
      style={[
        {
          width: s * 1.55,
          height: s * 1.2,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: mood.halo,
          shadowOpacity: isDark ? 0.55 : 0.25,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      {showWaves ? (
        <>
          <View
            style={[
              styles.wave,
              {
                width: s * 1.45,
                height: s * 0.55,
                opacity: listening ? 0.55 : 0.22,
                borderColor: `${tube}55`,
              },
            ]}
          />
          <View
            style={[
              styles.wave,
              {
                width: s * 1.25,
                height: s * 0.4,
                opacity: listening ? 0.4 : 0.14,
                borderColor: `${tube}40`,
              },
            ]}
          />
        </>
      ) : null}

      <LinearGradient
        colors={[`${tube}40`, `${tube}12`, "transparent"]}
        style={[
          styles.glow,
          {
            width: s * 1.15,
            height: s * 1.15,
            borderRadius: (s * 1.15) / 2,
          },
        ]}
      />

      <View
        style={[
          styles.ring,
          {
            width: s,
            height: s,
            borderRadius: s / 2,
            borderColor: listening ? tube : mood.edge,
          },
        ]}
      />

      <View
        style={[
          styles.ringMid,
          {
            width: s * 0.82,
            height: s * 0.82,
            borderRadius: (s * 0.82) / 2,
            borderColor: `${tube}40`,
          },
        ]}
      />

      <LinearGradient
        colors={
          isDark
            ? ["rgba(30,48,90,0.95)", "rgba(12,22,44,0.98)", "rgba(6,10,22,1)"]
            : ["#E8F0FE", "#C7D7F5", "#A8C0EC"]
        }
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[
          styles.core,
          {
            width: s * 0.52,
            height: s * 0.52,
            borderRadius: (s * 0.52) / 2,
            borderColor: mood.edge,
            shadowColor: mood.halo,
            shadowOpacity: 0.7,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        {/* Official logo shape only */}
        <EpheraBars state={liveState} size={s * 0.3} mode="flatWhite" />
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
  },
  wave: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.2,
    backgroundColor: "transparent",
  },
});
