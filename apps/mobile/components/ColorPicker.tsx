/**
 * Rainbow hue strip + saturation/value pad + hex type-in.
 * No third-party colour-picker dependency.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
} from "../lib/mood";
import { useTheme } from "../lib/theme-context";
import { radii } from "../theme";

type Props = {
  visible: boolean;
  title?: string;
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
};

const HUE_COLORS = [
  "#FF0000",
  "#FFFF00",
  "#00FF00",
  "#00FFFF",
  "#0000FF",
  "#FF00FF",
  "#FF0000",
] as const;

export function ColorPickerModal({
  visible,
  title = "Pick colour",
  value,
  onChange,
  onClose,
}: Props) {
  const { colors, mood, isDark } = useTheme();
  const initial = normalizeHex(value) ?? "#F4F8FF";
  const initHsv = hexToHsv(initial);
  const [h, setH] = useState(initHsv.h);
  const [s, setS] = useState(initHsv.s);
  const [v, setV] = useState(initHsv.v);
  const [hexText, setHexText] = useState(initial);
  const [svW, setSvW] = useState(280);
  const [svH, setSvH] = useState(160);
  const [hueW, setHueW] = useState(280);

  useEffect(() => {
    if (!visible) return;
    const n = normalizeHex(value) ?? "#F4F8FF";
    const hsv = hexToHsv(n);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    setHexText(n);
  }, [visible, value]);

  const live = useMemo(() => hsvToHex(h, s, v), [h, s, v]);
  const pureHue = useMemo(() => hsvToHex(h, 1, 1), [h]);

  function commitHex(raw: string) {
    const n = normalizeHex(raw);
    if (!n) return;
    const hsv = hexToHsv(n);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    setHexText(n);
  }

  function apply() {
    const n = normalizeHex(hexText) ?? live;
    onChange(n);
    onClose();
  }

  const svPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setS(Math.max(0, Math.min(1, locationX / Math.max(1, svW))));
        setV(Math.max(0, Math.min(1, 1 - locationY / Math.max(1, svH))));
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setS(Math.max(0, Math.min(1, locationX / Math.max(1, svW))));
        setV(Math.max(0, Math.min(1, 1 - locationY / Math.max(1, svH))));
      },
    }),
  ).current;

  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX } = e.nativeEvent;
        setH(Math.max(0, Math.min(1, locationX / Math.max(1, hueW))));
      },
      onPanResponderMove: (e) => {
        const { locationX } = e.nativeEvent;
        setH(Math.max(0, Math.min(1, locationX / Math.max(1, hueW))));
      },
    }),
  ).current;

  useEffect(() => {
    setHexText(live);
  }, [live]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#0C1526" : "#FFFFFF",
              borderColor: mood.edge,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>

          {/* Live swatch */}
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: live, borderColor: mood.edge }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700" }}>HEX</Text>
              <TextInput
                value={hexText}
                onChangeText={setHexText}
                onEndEditing={() => commitHex(hexText)}
                onSubmitEditing={() => commitHex(hexText)}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="#F4F8FF"
                placeholderTextColor={colors.textDim}
                style={[
                  styles.hexInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.04)",
                  },
                ]}
              />
            </View>
          </View>

          {/* SV pad */}
          <Text style={[styles.label, { color: colors.textDim }]}>Saturation · Brightness</Text>
          <View
            onLayout={(e: LayoutChangeEvent) => {
              setSvW(e.nativeEvent.layout.width);
              setSvH(e.nativeEvent.layout.height);
            }}
            style={styles.svBox}
            {...svPan.panHandlers}
          >
            <LinearGradient
              colors={["#FFFFFF", pureHue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["transparent", "#000000"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                styles.cursor,
                {
                  left: s * svW - 10,
                  top: (1 - v) * svH - 10,
                  borderColor: "#FFF",
                  backgroundColor: live,
                },
              ]}
            />
          </View>

          {/* Hue rainbow */}
          <Text style={[styles.label, { color: colors.textDim }]}>Hue</Text>
          <View
            onLayout={(e) => setHueW(e.nativeEvent.layout.width)}
            style={styles.hueBox}
            {...huePan.panHandlers}
          >
            <LinearGradient
              colors={[...HUE_COLORS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                styles.hueCursor,
                {
                  left: h * hueW - 8,
                  backgroundColor: pureHue,
                  borderColor: "#FFF",
                },
              ]}
            />
          </View>

          {/* Quick presets */}
          <View style={styles.presets}>
            {[
              "#F4F8FF",
              "#FFFFFF",
              "#60A5FA",
              "#22D3EE",
              "#34D399",
              "#FBBF24",
              "#F97316",
              "#F87171",
              "#E879F9",
              "#A78BFA",
              "#050B18",
              "#000000",
            ].map((c) => (
              <Pressable
                key={c}
                onPress={() => commitHex(c)}
                style={[
                  styles.presetDot,
                  {
                    backgroundColor: c,
                    borderColor: live === c ? mood.tube : "rgba(255,255,255,0.25)",
                    borderWidth: live === c ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={apply}
            style={[styles.apply, { backgroundColor: `${mood.tube}33`, borderColor: mood.edge }]}
          >
            <Text style={{ color: isDark ? mood.tube : colors.accentBright, fontWeight: "800" }}>
              Apply {live}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  hexInput: {
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  svBox: {
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  cursor: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  hueBox: {
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  hueCursor: {
    position: "absolute",
    top: 2,
    width: 16,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  presetDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  apply: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
});
