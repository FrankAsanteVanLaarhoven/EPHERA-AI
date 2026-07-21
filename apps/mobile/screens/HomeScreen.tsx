import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, space } from "@ephera/design-tokens";
import type { Screen } from "../App";

export default function HomeScreen({
  go,
}: {
  go: (screen: Screen, params?: Record<string, string>) => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>SANDBOX · NO LIVE FUNDS</Text>
      <Text style={styles.title}>EPHERA Money</Text>
      <Text style={styles.subtitle}>
        Voice-native mobile money. Speak what you need, see the cost, approve with a passkey,
        receive proof.
      </Text>

      <Pressable style={styles.primaryBtn} onPress={() => go("send")}>
        <Text style={styles.primaryBtnText}>Send money (demo panel)</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => go("voice")}>
        <Text style={styles.secondaryBtnText}>Push-to-talk</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryBtn, { marginTop: 8, borderColor: colors.danger }]}
        onPress={() => go("freeze")}
      >
        <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>Freeze wallet</Text>
      </Pressable>

      <Text style={styles.footer}>
        Running in Expo Go on the iOS Simulator. Backend: payments :8090 · voice :8091 · ledger
        :8092.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: space.lg,
    justifyContent: "center",
  },
  badge: {
    color: colors.accent,
    fontWeight: "700",
    marginBottom: space.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: space.sm,
    marginBottom: space.lg,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: space.sm,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: "600",
  },
  footer: {
    color: colors.textMuted,
    marginTop: space.lg,
    fontSize: 13,
    lineHeight: 18,
  },
});
