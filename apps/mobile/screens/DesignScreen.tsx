import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useMemo } from "react";

const { width: WIN_W, height: WIN_H } = Dimensions.get("window");

/** Design panel intrinsic aspect (after crop). Slightly taller phone UI. */
const PANEL_ASPECT = 355 / 560; // w/h ≈ 0.63

export type Hotspot = {
  /** fractions of the *image content* rect (0–1), not the full window */
  x: number;
  y: number;
  w: number;
  h: number;
  onPress: () => void;
};

function fitContain(containerW: number, containerH: number, aspect: number) {
  // aspect = width/height of image
  const containerAspect = containerW / containerH;
  let width: number;
  let height: number;
  if (containerAspect > aspect) {
    // container wider → letterbox sides
    height = containerH;
    width = height * aspect;
  } else {
    // container taller → letterbox top/bottom
    width = containerW;
    height = width / aspect;
  }
  const left = (containerW - width) / 2;
  const top = (containerH - height) / 2;
  return { width, height, left, top };
}

/**
 * Full design panel from product benchmark mockups.
 * Uses contain (not cover) so nothing is cropped; hotspots map to the image rect.
 */
export default function DesignScreen({
  source,
  hotspots = [],
  aspect = PANEL_ASPECT,
}: {
  source: ImageSourcePropType;
  hotspots?: Hotspot[];
  /** width/height of the design asset */
  aspect?: number;
}) {
  const layout = useMemo(
    () => fitContain(WIN_W, WIN_H, aspect),
    [aspect],
  );

  return (
    <View style={styles.root}>
      <Image
        source={source}
        style={{
          position: "absolute",
          left: layout.left,
          top: layout.top,
          width: layout.width,
          height: layout.height,
        }}
        resizeMode="contain"
      />
      {hotspots.map((hs, i) => {
        const style: ViewStyle = {
          position: "absolute",
          left: layout.left + hs.x * layout.width,
          top: layout.top + hs.y * layout.height,
          width: hs.w * layout.width,
          height: hs.h * layout.height,
        };
        return (
          <Pressable
            key={i}
            style={style}
            onPress={hs.onPress}
            accessibilityRole="button"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#02060F",
  },
});
