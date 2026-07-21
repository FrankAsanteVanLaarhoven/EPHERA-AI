import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme-context";
import { brandHaptic } from "../lib/brand-system/haptics";
import { brandSonic } from "../lib/brand-system/sonic";
import { tacticalClick } from "../lib/tactical-clicks";
import { NeonLogo } from "./brand/NeonLogo";

type Props = {
  onPress: () => void;
  visible?: boolean;
};

/**
 * Voice operator — official logo silhouette, neon tube light, no invented shape.
 */
export function FloatingVoiceOrb({ onPress, visible = true }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark, mood } = useTheme();
  if (!visible) return null;

  const bottom = Math.max(insets.bottom, 8) + 52;

  function handlePress() {
    void brandHaptic("voiceActivated");
    void brandSonic("listening");
    void tacticalClick("voice_open");
    onPress();
  }

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom }]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Open voice mode"
        accessibilityHint="Activates Ephera voice."
        style={({ pressed }) => [
          styles.hit,
          { transform: [{ scale: pressed ? 0.94 : 1 }], opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View
          style={{
            shadowColor: mood.halo,
            shadowOpacity: isDark ? 0.75 : 0.35,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <LinearGradient
            colors={
              isDark
                ? [`${mood.tube}44`, "rgba(20,32,58,0.75)", "rgba(6,10,20,0.92)"]
                : ["rgba(255,255,255,0.95)", `${mood.tube}33`, "rgba(226,232,240,0.9)"]
            }
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.orb, { borderColor: mood.edge }]}
          >
            <View style={[styles.ring, { borderColor: `${mood.tube}55` }]} />
            <View
              style={[
                styles.core,
                {
                  backgroundColor: isDark
                    ? "rgba(8,14,28,0.55)"
                    : "rgba(255,255,255,0.45)",
                },
              ]}
            >
              <NeonLogo size={28} layout="symbol" intensity="crisp" plate={false} />
            </View>
          </LinearGradient>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  hit: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  orb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 1.8,
  },
  ring: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  core: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
