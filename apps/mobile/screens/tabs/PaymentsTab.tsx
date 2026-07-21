import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EpheraMark } from "../../components/EpheraMark";
import {
  GlassCard,
  Icon,
  IconWell,
  IlluminatedText,
  Screen,
  type IconName,
} from "../../components/ui";
import { useTheme } from "../../lib/theme-context";
import type { Screen as Route } from "../../lib/navigation";
import { space, type as typeStyles, typography } from "../../theme";

type Go = (screen: Route, params?: Record<string, string>) => void;

const GROUPS: {
  title: string;
  items: { icon: IconName; title: string; sub: string; go: Route; tone?: "tube" | "cyan" | "accent" }[];
}[] = [
  {
    title: "Move money",
    items: [
      { icon: "send", title: "Send", sub: "Contacts, bank, MoMo, username", go: "send" },
      { icon: "receive", title: "Receive", sub: "QR, link, bank details", go: "receive" },
      { icon: "qr", title: "Scan QR", sub: "Pay from camera", go: "scan" },
      { icon: "globe", title: "Cross-border", sub: "Compare routes & rates", go: "crossBorder", tone: "cyan" },
      { icon: "cashout", title: "Cash out", sub: "Agent or ATM partner", go: "send" },
    ],
  },
  {
    title: "Pay for things",
    items: [
      { icon: "bolt", title: "Bills & utilities", sub: "Electricity, water, TV, rent", go: "bills", tone: "accent" },
      { icon: "phone", title: "Airtime & data", sub: "Self, others, eSIM, bundles", go: "airtime" },
      { icon: "merchant", title: "Merchant pay", sub: "Scan QR, accept, invoices", go: "merchant" },
    ],
  },
];

export default function PaymentsTab({ go }: { go: Go }) {
  const insets = useSafeAreaInsets();
  const { colors, mood, isDark } = useTheme();

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 12 }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <EpheraMark size={30} variant="crisp" />
          <IlluminatedText
            tone="tube"
            style={{ ...typeStyles.screenTitle, letterSpacing: 1.2 }}
          >
            PAYMENTS
          </IlluminatedText>
        </View>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: typography.caption,
            marginTop: 6,
            fontWeight: "500",
            letterSpacing: 0.3,
          }}
        >
          Send, receive, bills and transfers
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginBottom: 20 }}>
            <Text
              style={[
                styles.group,
                {
                  color: isDark ? mood.tube : colors.textDim,
                  textShadowColor: isDark ? mood.halo : "transparent",
                  textShadowRadius: isDark ? 6 : 0,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              {g.title}
            </Text>
            <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
              {g.items.map((item, i) => (
                <Pressable
                  key={item.title}
                  onPress={() => go(item.go)}
                  style={({ pressed }) => [
                    styles.row,
                    i < g.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <IconWell name={item.icon} size={42} tone={item.tone ?? "tube"} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isDark ? mood.textGlow : colors.text,
                        fontWeight: "700",
                        fontSize: 14,
                        letterSpacing: 0.2,
                        textShadowColor: isDark ? mood.halo : "transparent",
                        textShadowRadius: isDark ? 5 : 0,
                        textShadowOffset: { width: 0, height: 0 },
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      {item.sub}
                    </Text>
                  </View>
                  <Icon name="chevron" size={16} color={colors.textDim} />
                </Pressable>
              ))}
            </GlassCard>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  group: {
    ...typeStyles.kicker,
    marginBottom: 8,
    letterSpacing: 1.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
