import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Screen } from "../App";

const BOARD = require("../assets/design-board.jpg");
const { width: WIN_W } = Dimensions.get("window");

/** Full product design board (2×3) — one window to see every screen. */
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
  { id: "listening", label: "Listening", x: 0.02, y: 0.34, w: 0.47, h: 0.32 },
  { id: "home", label: "Home", x: 0.51, y: 0.34, w: 0.47, h: 0.32 },
  { id: "services", label: "Services", x: 0.02, y: 0.665, w: 0.47, h: 0.32 },
  { id: "voiceMode", label: "Voice Mode", x: 0.51, y: 0.665, w: 0.47, h: 0.32 },
];

export default function DesignBoardScreen({
  go,
}: {
  go: (screen: Screen, params?: Record<string, string>) => void;
}) {
  const insets = useSafeAreaInsets();
  const boardW = WIN_W;
  const boardH = boardW * (1844 / 853);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.kicker}>EPHERA · PRODUCT DASHBOARD</Text>
          <Text style={styles.title}>All screens · one view</Text>
        </View>
        <Pressable style={styles.enterBtn} onPress={() => go("splash")}>
          <Text style={styles.enterText}>Open app →</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Scroll the board. Tap any phone to open that full screen (no crop).
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          width: boardW,
          minHeight: boardH + 24,
          paddingBottom: insets.bottom + 16,
        }}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsVerticalScrollIndicator
        bouncesZoom
      >
        <View style={{ width: boardW, height: boardH }}>
          <Image
            source={BOARD}
            style={{ width: boardW, height: boardH }}
            resizeMode="contain"
          />
          {PANELS.map((p) => (
            <Pressable
              key={p.id}
              accessibilityLabel={p.label}
              onPress={() => go(p.id)}
              style={[
                styles.hotspot,
                {
                  left: p.x * boardW,
                  top: p.y * boardH,
                  width: p.w * boardW,
                  height: p.h * boardH,
                },
              ]}
            >
              <View style={styles.hotspotLabel}>
                <Text style={styles.hotspotLabelText}>{p.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {(
          [
            ["Wallet", "home"],
            ["Voice", "listening"],
            ["Send", "send"],
            ["Services", "services"],
          ] as const
        ).map(([label, screen]) => (
          <Pressable
            key={label}
            style={styles.chip}
            onPress={() => go(screen)}
          >
            <Text style={styles.chipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#02060F" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: {
    color: "#60A5FA",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: "#F4F8FF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  enterBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  enterText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hint: {
    color: "#8B9BB8",
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  hotspot: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(96,165,250,0.35)",
    borderRadius: 18,
    backgroundColor: "rgba(37,99,235,0.04)",
  },
  hotspotLabel: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(2,6,15,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
  },
  hotspotLabelText: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
    backgroundColor: "#050B18",
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(18,29,50,0.95)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.25)",
  },
  chipText: { color: "#E2E8F0", fontSize: 12, fontWeight: "600" },
});
