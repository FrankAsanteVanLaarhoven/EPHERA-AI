import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { Screen } from "../lib/navigation";
import { GlassIconButton } from "../components/ui";

const BOARD = require("../assets/design-board.jpg");
const BOARD_W = 853;
const BOARD_H = 1844;

/**
 * Product design dashboard — full 2×3 board overview.
 * Tap any panel to open the live screen for that flow.
 */
const PANELS: {
  id: Screen;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [
  { id: "splash", label: "Splash", x: 0.02, y: 0.015, w: 0.47, h: 0.32 },
  { id: "welcome", label: "Welcome", x: 0.51, y: 0.015, w: 0.47, h: 0.32 },
  { id: "voice", label: "Listening", x: 0.02, y: 0.34, w: 0.47, h: 0.32 },
  { id: "home", label: "Home dashboard", x: 0.51, y: 0.34, w: 0.47, h: 0.32 },
  { id: "servicesDrawer", label: "Services", x: 0.02, y: 0.665, w: 0.47, h: 0.32 },
  { id: "voice", label: "Voice Mode", x: 0.51, y: 0.665, w: 0.47, h: 0.32 },
];

function fitContain(cw: number, ch: number) {
  if (cw <= 0 || ch <= 0) return { width: 0, height: 0, left: 0, top: 0 };
  const scale = Math.min(cw / BOARD_W, ch / BOARD_H) * 0.98;
  const width = BOARD_W * scale;
  const height = BOARD_H * scale;
  return {
    width,
    height,
    left: (cw - width) / 2,
    top: (ch - height) / 2,
  };
}

export default function DesignBoardScreen({
  go,
  back,
}: {
  go: (screen: Screen, params?: Record<string, string>) => void;
  back?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  // Reserve header strip so close + title never cover panels
  const headerH = insets.top + 44;
  const footerH = Math.max(insets.bottom, 10) + 8;
  const availH = Math.max(size.h - headerH - footerH, 0);
  const layout = useMemo(
    () => fitContain(size.w, availH),
    [size.w, availH],
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        {back ? (
          <GlassIconButton label="←" onPress={back} size={34} />
        ) : (
          <View style={{ width: 34 }} />
        )}
        <View style={styles.titles}>
          <Text style={styles.kicker}>EPHERA</Text>
          <Text style={styles.title}>Design dashboard</Text>
        </View>
        <Pressable
          onPress={() => go("home")}
          hitSlop={10}
          style={({ pressed }) => [styles.openApp, { opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={["rgba(59,130,246,0.5)", "rgba(37,99,235,0.25)"]}
            style={styles.openAppInner}
          >
            <Text style={styles.openAppText}>App →</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.boardArea}>
        {size.w > 0 && layout.width > 0 && (
          <View
            style={{
              position: "absolute",
              left: layout.left,
              top: layout.top,
              width: layout.width,
              height: layout.height,
            }}
          >
            <Image
              source={BOARD}
              style={{ width: layout.width, height: layout.height }}
              resizeMode="contain"
            />
            {PANELS.map((p, i) => (
              <Pressable
                key={`${p.label}-${i}`}
                accessibilityLabel={p.label}
                accessibilityRole="button"
                onPress={() => go(p.id)}
                style={[
                  styles.hotspot,
                  {
                    left: p.x * layout.width,
                    top: p.y * layout.height,
                    width: p.w * layout.width,
                    height: p.h * layout.height,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <Text style={[styles.hint, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        Tap a panel to open that live screen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#02060F",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 4,
    gap: 10,
  },
  titles: { flex: 1, alignItems: "center" },
  kicker: {
    color: "rgba(147,197,253,0.85)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: "#F4F8FF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 1,
  },
  openApp: { borderRadius: 16, overflow: "hidden" },
  openAppInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(147,197,253,0.45)",
  },
  openAppText: { color: "#F0F7FF", fontWeight: "700", fontSize: 12 },
  boardArea: { flex: 1 },
  hotspot: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  hint: {
    textAlign: "center",
    color: "rgba(148,163,184,0.65)",
    fontSize: 11,
    fontWeight: "500",
    paddingTop: 4,
  },
});
