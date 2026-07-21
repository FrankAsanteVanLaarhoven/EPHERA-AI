/**
 * Official EPHERA logo — silhouette only.
 *
 * - crisp: single sharp image (headers, tabs, small UI) — always readable
 * - tube: multi-layer neon halo for splash / large surfaces
 * - metal: dark metal master
 *
 * Logo tube colour and plate bg come from theme.logo (separate from HUD mood).
 */
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type ViewStyle,
} from "react-native";
import { BrandAssets } from "../../lib/brand";
import { useTheme } from "../../lib/theme-context";

type Layout = "symbol" | "horizontal" | "stacked";

export type LogoIntensity = "crisp" | "tube" | "neon" | "metal";

type Props = {
  size?: number;
  layout?: Layout;
  /**
   * crisp — single official image, strong halo (default under 48px)
   * tube — full silhouette neon layers (splash / large)
   * neon — bright core only
   * metal — dark metal
   */
  intensity?: LogoIntensity;
  /** @deprecated */
  neon?: boolean;
  pulse?: boolean;
  style?: ViewStyle;
  /** Force plate on/off; default uses logo.bgEnabled */
  plate?: boolean;
  showTagline?: boolean;
  tagline?: "campaign" | "institutional" | "none";
};

const ASPECT: Record<Layout, number> = {
  symbol: 1,
  horizontal: 1501 / 302,
  stacked: 1111 / 777,
};

/** Below this size always prefer crisp (readable) */
const CRISP_MAX = 52;

function tubeSource(layout: Layout, electric: boolean): ImageSourcePropType {
  if (layout === "horizontal") return BrandAssets.officialHorizontalTube;
  if (layout === "stacked") {
    return electric
      ? BrandAssets.officialStackedTubeElectric
      : BrandAssets.officialStackedTube;
  }
  return electric
    ? BrandAssets.officialSymbolTubeElectric
    : BrandAssets.officialSymbolTube;
}

function coreSource(layout: Layout, metal: boolean): ImageSourcePropType {
  if (layout === "horizontal") {
    return metal ? BrandAssets.officialHorizontal : BrandAssets.officialHorizontalNeon;
  }
  if (layout === "stacked") {
    return metal ? BrandAssets.officialStacked : BrandAssets.officialStackedNeon;
  }
  return metal ? BrandAssets.officialSymbol : BrandAssets.officialSymbolNeon;
}

function dims(layout: Layout, size: number) {
  if (layout === "symbol") return { w: size, h: size };
  if (layout === "horizontal") return { w: size * ASPECT.horizontal, h: size };
  return { w: size * ASPECT.stacked, h: size * 1.55 };
}

export function NeonLogo({
  size = 48,
  layout = "symbol",
  intensity,
  neon = true,
  pulse = false,
  style,
  plate,
}: Props) {
  const { isDark, logo } = useTheme();
  const logoTube = logo.tube;
  const showPlate = plate ?? logo.bgEnabled;

  let mode: LogoIntensity =
    intensity ?? (neon === false ? "metal" : "tube");
  // Force crisp at small sizes so header never washes out
  if ((mode === "tube" || mode === "neon") && size <= CRISP_MAX) {
    mode = "crisp";
  }

  const { w: coreW, h: coreH } = dims(layout, size);
  const glow = useRef(new Animated.Value(pulse ? 0.6 : 1)).current;

  useEffect(() => {
    if (!pulse || mode === "metal" || mode === "crisp") {
      glow.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.5,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, mode, glow]);

  const core = coreSource(layout, mode === "metal");
  const electric = !isDark;
  const tube = tubeSource(layout, electric);

  const platePad = showPlate ? Math.max(6, size * 0.12) : 0;
  const outerW = coreW + platePad * 2;
  const outerH = coreH + platePad * 2;

  const wrap = (child: React.ReactNode) => (
    <View
      style={[
        {
          width: outerW,
          height: outerH,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: showPlate ? logo.bg : "transparent",
          borderRadius: showPlate
            ? layout === "horizontal"
              ? Math.min(outerH * 0.35, 14)
              : outerH * 0.18
            : 0,
          padding: platePad,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {child}
    </View>
  );

  // ——— CRISP: single official image, strong logo-tube halo ———
  if (mode === "crisp" || mode === "neon") {
    return wrap(
      <View
        style={{
          width: coreW,
          height: coreH,
          shadowColor: logoTube,
          shadowOpacity: isDark ? 0.95 : 0.45,
          shadowRadius: Math.max(8, size * 0.22),
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Image
          source={core}
          style={
            {
              width: coreW,
              height: coreH,
              backgroundColor: "transparent",
              // Tint glow pass toward logo tube on dark UI
              tintColor: isDark && mode === "crisp" ? undefined : undefined,
            } as ImageStyle
          }
          resizeMode="contain"
          accessibilityLabel="EPHERA"
        />
        {/* Soft colour wash layer — same silhouette, logo tube colour */}
        {isDark ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
              source={core}
              style={
                {
                  width: coreW,
                  height: coreH,
                  tintColor: logoTube,
                  opacity: 0.35,
                } as ImageStyle
              }
              resizeMode="contain"
            />
          </View>
        ) : null}
      </View>,
    );
  }

  if (mode === "metal") {
    return wrap(
      <Image
        source={core}
        style={
          {
            width: coreW,
            height: coreH,
            backgroundColor: "transparent",
          } as ImageStyle
        }
        resizeMode="contain"
        accessibilityLabel="EPHERA"
      />,
    );
  }

  // ——— TUBE: multi-layer for large splash only ———
  const pad = 1.12;
  return wrap(
    <View
      style={{
        width: coreW * pad,
        height: coreH * pad,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: logoTube,
        shadowOpacity: isDark ? 0.95 : 0.5,
        shadowRadius: Math.max(18, size * 0.32),
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            alignItems: "center",
            justifyContent: "center",
            opacity: glow.interpolate({
              inputRange: [0.5, 1],
              outputRange: [0.4, 0.85],
            }),
          },
        ]}
      >
        <Image
          source={tube}
          style={
            {
              width: coreW * 1.1,
              height: coreH * 1.1,
              tintColor: logoTube,
              opacity: 0.75,
              backgroundColor: "transparent",
            } as ImageStyle
          }
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={{ opacity: glow }}>
        <Image
          source={tube}
          style={
            {
              width: coreW * 1.02,
              height: coreH * 1.02,
              backgroundColor: "transparent",
            } as ImageStyle
          }
          resizeMode="contain"
        />
      </Animated.View>

      <Image
        source={core}
        style={
          {
            position: "absolute",
            width: coreW * 0.9,
            height: coreH * 0.9,
            backgroundColor: "transparent",
          } as ImageStyle
        }
        resizeMode="contain"
        accessibilityLabel="EPHERA"
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          opacity: glow.interpolate({
            inputRange: [0.5, 1],
            outputRange: [0.15, 0.4],
          }),
        }}
      >
        <Image
          source={core}
          style={
            {
              width: coreW * 0.88,
              height: coreH * 0.88,
              tintColor: logoTube,
              backgroundColor: "transparent",
            } as ImageStyle
          }
          resizeMode="contain"
        />
      </Animated.View>
    </View>,
  );
}
