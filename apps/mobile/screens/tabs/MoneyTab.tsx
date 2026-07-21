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

const ITEMS: {
  icon: IconName;
  title: string;
  sub: string;
  go: Route;
  tone?: "tube" | "success" | "accent" | "cyan";
}[] = [
  { icon: "wallet", title: "Accounts & wallets", sub: "Ephera, bank, MoMo, FX", go: "accounts" },
  { icon: "home", title: "Savings", sub: "Goals, round-ups, locked pots", go: "savings", tone: "success" },
  { icon: "card", title: "Cards", sub: "Virtual, physical, limits", go: "cards" },
  { icon: "chart", title: "Invest", sub: "When licensed in your market", go: "invest", tone: "accent" },
  { icon: "insurance", title: "Insurance", sub: "Device, health cash, travel", go: "insurance" },
  { icon: "credit", title: "Credit", sub: "Full cost before you accept", go: "credit" },
  { icon: "exchange", title: "Exchange", sub: "Rates, convert, alerts", go: "exchange", tone: "cyan" },
  { icon: "family", title: "Family & shared", sub: "Allowances, school fees", go: "family" },
  { icon: "insights", title: "Insights", sub: "Spending you can explain", go: "insights" },
];

export default function MoneyTab({ go }: { go: Go }) {
  const insets = useSafeAreaInsets();
  const { colors, mood, isDark } = useTheme();

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 12 }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <EpheraMark size={30} variant="crisp" />
          <IlluminatedText tone="tube" style={{ ...typeStyles.screenTitle, letterSpacing: 1.2 }}>
            MONEY
          </IlluminatedText>
        </View>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: typography.caption,
            marginTop: 6,
            fontWeight: "500",
          }}
        >
          Grow and protect — savings, cards, cover, credit
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
          {ITEMS.map((item, i) => (
            <Pressable
              key={item.title}
              onPress={() => go(item.go)}
              style={({ pressed }) => [
                styles.row,
                i < ITEMS.length - 1 && {
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
        <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 16, lineHeight: 16 }}>
          Investments, credit and insurance only appear where licensed. Costs and
          exclusions are always shown before you commit.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
