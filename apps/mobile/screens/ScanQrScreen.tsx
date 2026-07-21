import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, PrimaryButton } from "../components/ui";
import { GlassIconButton } from "../components/ui";
import { useTheme } from "../lib/theme-context";
import {
  parsePayPayload,
  amountToMinor,
  type PayPayload,
} from "../lib/paymentLink";
import type { Screen as Route } from "../lib/navigation";

type Go = (s: Route, p?: Record<string, string>) => void;

export default function ScanQrScreen({
  go,
  back,
}: {
  go: Go;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PayPayload | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const applyPayload = useCallback(
    (payload: PayPayload) => {
      const minor = amountToMinor(payload.amount) ?? 10000;
      go("send", {
        intentJson: JSON.stringify({
          id: `qr_${Date.now()}`,
          name: "send_money",
          language: "en",
          confidence: 0.99,
          amount: { amountMinor: minor, currency: payload.currency || "GHS" },
          recipient: {
            displayName: payload.displayName || `@${payload.to}`,
            verified: true,
            accountHint:
              payload.kind === "merchant"
                ? `merchant · ${payload.merchantId ?? payload.to}`
                : `ephera · @${payload.to}`,
          },
          rawUtterance: payload.note,
          createdAt: new Date().toISOString(),
        }),
        fromQr: "1",
      });
    },
    [go],
  );

  const onBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (locked) return;
      const payload = parsePayPayload(data);
      if (!payload) {
        setError("Unrecognised QR. Use an Ephera payment code.");
        return;
      }
      setLocked(true);
      setError(null);
      setPreview(payload);
      try {
        Vibration.vibrate(40);
      } catch {
        /* ignore */
      }
    },
    [locked],
  );

  function submitManual() {
    const payload = parsePayPayload(manual);
    if (!payload) {
      setError("Could not parse that code or handle.");
      return;
    }
    setPreview(payload);
    setError(null);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bgDeep }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <GlassIconButton label="✕" onPress={back} size={34} />
        <Text style={[styles.title, { color: colors.text }]}>Scan to pay</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={locked ? undefined : onBarcode}
          />
        ) : (
          <View style={[styles.noCam, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
              Camera access is needed to scan payment QR codes.
            </Text>
            <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} size="md" />
          </View>
        )}

        {/* Viewfinder frame */}
        <View style={styles.frame} pointerEvents="none">
          <View style={[styles.corner, styles.tl, { borderColor: colors.accentBright }]} />
          <View style={[styles.corner, styles.tr, { borderColor: colors.accentBright }]} />
          <View style={[styles.corner, styles.bl, { borderColor: colors.accentBright }]} />
          <View style={[styles.corner, styles.br, { borderColor: colors.accentBright }]} />
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {preview ? (
          <GlassCard style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700" }}>
              SCANNED
            </Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 6 }}>
              {preview.displayName || `@${preview.to}`}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>
              {preview.amount
                ? `${preview.currency} ${preview.amount}`
                : "Amount not set — you choose on next step"}
            </Text>
            {preview.note ? (
              <Text style={{ color: colors.textDim, marginTop: 4, fontSize: 12 }}>
                {preview.note}
              </Text>
            ) : null}
            <View style={{ height: 12 }} />
            <PrimaryButton label="Continue to review" onPress={() => applyPayload(preview)} />
            <View style={{ height: 8 }} />
            <PrimaryButton
              label="Scan again"
              variant="ghost"
              onPress={() => {
                setPreview(null);
                setLocked(false);
              }}
            />
          </GlassCard>
        ) : (
          <>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
              Align an Ephera payment QR inside the frame
            </Text>
            <GlassCard>
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
                Or enter handle / code
              </Text>
              <TextInput
                value={manual}
                onChangeText={setManual}
                placeholder="@username or ephera://pay?…"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)",
                  },
                ]}
              />
              <View style={{ height: 10 }} />
              <PrimaryButton label="Use code" variant="secondary" onPress={submitManual} size="md" />
            </GlassCard>
          </>
        )}
        {error ? (
          <Text style={{ color: colors.danger, marginTop: 10, textAlign: "center", fontSize: 12 }}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    zIndex: 2,
  },
  title: { flex: 1, textAlign: "center", fontWeight: "700", fontSize: 16 },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 280,
  },
  noCam: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  frame: {
    position: "absolute",
    top: "18%",
    left: "12%",
    right: "12%",
    bottom: "18%",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  sheet: { paddingHorizontal: 16, paddingTop: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
