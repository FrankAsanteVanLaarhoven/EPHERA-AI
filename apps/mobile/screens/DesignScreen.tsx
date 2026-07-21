import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");

export type Hotspot = {
  /** fractions of screen 0–1 */
  x: number;
  y: number;
  w: number;
  h: number;
  onPress: () => void;
};

/**
 * Full-bleed design panel from product benchmark mockups.
 * Invisible hotspots drive navigation / actions.
 */
export default function DesignScreen({
  source,
  hotspots = [],
}: {
  source: ImageSourcePropType;
  hotspots?: Hotspot[];
}) {
  const insets = useSafeAreaInsets();
  // Use full window; mockups already include status chrome
  return (
    <View style={styles.root}>
      <Image source={source} style={styles.image} resizeMode="cover" />
      {hotspots.map((hs, i) => {
        const style: ViewStyle = {
          position: "absolute",
          left: hs.x * W,
          top: hs.y * H,
          width: hs.w * W,
          height: hs.h * H,
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
      {/* keep safe area tappable for top status if needed */}
      <View pointerEvents="none" style={{ height: insets.top }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#02060F",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: W,
    height: H,
  },
});
