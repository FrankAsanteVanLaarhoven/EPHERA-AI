import {
  Dimensions,
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useCallback, useMemo, useState } from "react";

export type Hotspot = {
  /** fractions of the fitted image (0–1) */
  x: number;
  y: number;
  w: number;
  h: number;
  onPress: () => void;
  label?: string;
};

type Box = { width: number; height: number; left: number; top: number };

function fitContain(cw: number, ch: number, imgW: number, imgH: number): Box {
  if (cw <= 0 || ch <= 0 || imgW <= 0 || imgH <= 0) {
    return { width: cw, height: ch, left: 0, top: 0 };
  }
  const scale = Math.min(cw / imgW, ch / imgH); // zoom OUT to fit entirely
  const width = imgW * scale;
  const height = imgH * scale;
  return {
    width,
    height,
    left: (cw - width) / 2,
    top: (ch - height) / 2,
  };
}

/**
 * Design panel that always fits entirely in the window (letterboxed).
 * Hotspots are relative to the visible image rectangle.
 */
export default function DesignScreen({
  source,
  hotspots = [],
}: {
  source: ImageSourcePropType;
  hotspots?: Hotspot[];
}) {
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ w: width, h: height });
  }, []);

  const onLoad = useCallback(
    (e: { nativeEvent: { source: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.source;
      if (width && height) setNatural({ w: width, h: height });
    },
    [],
  );

  // Fallback dimensions from require() via resolveAssetSource
  const resolved = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Image: RNImage } = require("react-native");
      const r = RNImage.resolveAssetSource(source);
      return { w: r?.width ?? 762, h: r?.height ?? 1140 };
    } catch {
      return { w: 762, h: 1140 };
    }
  }, [source]);

  const imgW = natural.w || resolved.w;
  const imgH = natural.h || resolved.h;

  const layout = useMemo(
    () => fitContain(container.w, container.h, imgW, imgH),
    [container.w, container.h, imgW, imgH],
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {container.w > 0 && (
        <>
          <Image
            source={source}
            onLoad={onLoad}
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
              width: Math.max(44, hs.w * layout.width),
              height: Math.max(44, hs.h * layout.height),
            };
            return (
              <Pressable
                key={i}
                style={style}
                onPress={hs.onPress}
                accessibilityRole="button"
                accessibilityLabel={hs.label}
              />
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#02060F",
  },
});
