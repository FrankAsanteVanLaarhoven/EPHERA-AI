import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, Screen } from "../components/ui";
import { colors, space, typography } from "../theme";
import type { Screen as Route } from "../App";

const NOTIFS = [
  {
    title: "Payment received",
    body: "Ama Mensah sent you GH₵ 200.00",
    time: "2h ago",
    icon: "↓",
    color: "#34D399",
  },
  {
    title: "Security tip",
    body: "Enable Face ID / passkey for faster secure sends.",
    time: "Yesterday",
    icon: "🛡",
    color: "#60A5FA",
  },
  {
    title: "Wallet status",
    body: "Your wallet is ready. Voice proposes, passkey authorises.",
    time: "2d ago",
    icon: "◆",
    color: "#A78BFA",
  },
];

export default function NotificationsScreen({
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  return (
    <Screen>
      <Pressable onPress={back}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.sub}>Payments, security and product updates.</Text>

      <ScrollView style={{ marginTop: space.lg }} showsVerticalScrollIndicator={false}>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
          {NOTIFS.map((n, i) => (
            <View
              key={n.title}
              style={[styles.row, i === NOTIFS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[styles.icon, { backgroundColor: `${n.color}22` }]}>
                <Text style={{ fontSize: 16 }}>{n.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nTitle}>{n.title}</Text>
                <Text style={styles.nBody}>{n.body}</Text>
                <Text style={styles.time}>{n.time}</Text>
              </View>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.accentBright, fontWeight: "600", marginBottom: space.sm },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "700",
  },
  sub: { color: colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
  nBody: { color: colors.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  time: { color: colors.textDim, fontSize: 11, marginTop: 6 },
});
