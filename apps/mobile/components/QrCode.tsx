import { View, StyleSheet, Text, Image } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../lib/theme-context";
import { BrandAssets } from "../lib/brand";

type Props = {
  value: string;
  size?: number;
  /** Quiet white plate for reliable scanning */
  label?: string;
};

/**
 * Production QR plate — high contrast on white, brand mark overlay center.
 */
export function QrCodeView({ value, size = 200, label }: Props) {
  const { colors, isDark } = useTheme();
  const plate = size + 28;
  const logoBox = Math.round(size * 0.18);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.plate,
          {
            width: plate,
            height: plate,
            backgroundColor: "#FFFFFF",
            shadowColor: isDark ? "#3B82F6" : "#000",
          },
        ]}
      >
        <QRCode
          value={value || "ephera://pay?v=1&to=ephera"}
          size={size}
          backgroundColor="#FFFFFF"
          color="#0B1220"
          ecl="H"
        />
        <View
          style={[
            styles.logo,
            {
              width: logoBox + 8,
              height: logoBox + 8,
              borderRadius: 6,
            },
          ]}
        >
          <Image
            source={BrandAssets.markUi}
            style={{ width: logoBox * 0.92, height: logoBox * 0.92 }}
            resizeMode="contain"
          />
        </View>
      </View>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  plate: {
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logo: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // thin white pad so QR stays scannable; mark itself is transparent PNG
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  label: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
