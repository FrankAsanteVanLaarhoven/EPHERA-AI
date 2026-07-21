/**
 * Living three-bar mark — always the official logo silhouette.
 * Motion is applied to the real mark (scale / opacity / separation),
 * never a re-drawn rectangle approximation.
 */
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from "react-native";
import { BrandAssets } from "../../lib/brand";
import type { SymbolState } from "../../lib/brand-system/tokens";
import { useTheme } from "../../lib/theme-context";

type Props = {
  state?: SymbolState;
  size?: number;
  mode?: "flatWhite" | "flatDark";
  reducedMotion?: boolean;
};

export function EpheraBars({
  state = "idle",
  size = 40,
  mode,
  reducedMotion: reducedProp,
}: Props) {
  const { isDark, mood, colors, logo } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useRef(!!reducedProp);

  const neon = mode !== "flatDark";
  // Crisp official symbol — readable at all sizes
  const source = neon ? BrandAssets.officialSymbolNeon : BrandAssets.officialSymbol;
  const glowColor = logo.tube || mood.halo;

  useEffect(() => {
    if (reducedProp !== undefined) {
      reduced.current = reducedProp;
      return;
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduced.current = v;
    });
  }, [reducedProp]);

  useEffect(() => {
    pulse.stopAnimation();
    scale.stopAnimation();
    pulse.setValue(0);
    scale.setValue(1);

    if (reduced.current || state === "idle" || state === "notListening" || state === "micDisabled") {
      return;
    }

    if (state === "listening" || state === "listeningLocal" || state === "voiceActivated") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.06,
            duration: 520,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.96,
            duration: 520,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    if (state === "processing" || state === "cloudProcessing") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 480,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 480,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    if (state === "confirmation" || state === "paymentCompleted") {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 180, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }

    if (state === "securityWarning") {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.92, duration: 100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [state, pulse, scale]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const isWarn = state === "recordingConsent" || state === "securityWarning";
  const isOff = state === "micDisabled";
  const isProcess = state === "processing" || state === "cloudProcessing";

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`EPHERA symbol, ${state}`}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        shadowColor: isWarn ? colors.warning : glowColor,
        shadowOpacity: isDark && !isOff ? 0.9 : 0.3,
        shadowRadius: size * 0.22,
        shadowOffset: { width: 0, height: 0 },
        opacity: isOff ? 0.4 : 1,
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale }],
          opacity: isProcess ? opacity : 1,
        }}
      >
        <Image
          source={source}
          style={{ width: size, height: size, backgroundColor: "transparent" }}
          resizeMode="contain"
        />
      </Animated.View>
      {isOff ? (
        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: size * 0.72,
              height: 2,
              backgroundColor: colors.danger,
              transform: [{ rotate: "-28deg" }],
              borderRadius: 1,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
