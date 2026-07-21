import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { colors, space } from "@ephera/design-tokens";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>SANDBOX · NO LIVE FUNDS</Text>
      <Text style={styles.title}>EPHERA Money</Text>
      <Text style={styles.subtitle}>
        Voice-native mobile money. Speak what you need, see the cost, approve with a passkey,
        receive proof.
      </Text>

      <Link href="/send" asChild>
        <Pressable style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Send money (demo panel)</Text>
        </Pressable>
      </Link>

      <Link href="/voice" asChild>
        <Pressable style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Push-to-talk (stub)</Text>
        </Pressable>
      </Link>

      <Text style={styles.footer}>
        Use Expo development builds for passkeys, secure storage and native voice modules. Expo Go
        is not the production path.
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
