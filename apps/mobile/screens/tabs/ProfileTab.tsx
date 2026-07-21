import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/Avatar";
import { EpheraWordmark } from "../../components/EpheraMark";
import {
  GlassCard,
  Icon,
  IconWell,
  IlluminatedText,
  Screen,
  type IconName,
} from "../../components/ui";
import { useProfile } from "../../lib/profile";
import { useTheme } from "../../lib/theme-context";
import type { Screen as Route } from "../../lib/navigation";
import { space, type as typeStyles, typography } from "../../theme";

type Go = (screen: Route, params?: Record<string, string>) => void;

const SECTIONS: {
  title: string;
  items: { icon: IconName; title: string; go: Route; sub?: string; tone?: "tube" | "danger" | "success" | "warning" }[];
}[] = [
  {
    title: "Account",
    items: [
      { icon: "user", title: "Personal details", go: "settings" },
      { icon: "passkey", title: "Identity & verification", go: "identity", tone: "success" },
      { icon: "card", title: "Linked accounts", go: "accounts" },
      { icon: "chart", title: "Limits", go: "security" },
    ],
  },
  {
    title: "Safety",
    items: [
      { icon: "shield", title: "Security centre", go: "security", tone: "success" },
      { icon: "freeze", title: "Emergency freeze", go: "freeze", tone: "danger" },
      { icon: "support", title: "Support & disputes", go: "support" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { icon: "settings", title: "Settings", go: "settings" },
      { icon: "accessibility", title: "Accessibility", go: "accessibility" },
      { icon: "bell", title: "Notifications", go: "notifications" },
    ],
  },
  {
    title: "Product",
    items: [
      {
        icon: "spark",
        title: "Design dashboard",
        go: "board",
        sub: "All screens overview",
      },
    ],
  },
];

export default function ProfileTab({ go }: { go: Go }) {
  const insets = useSafeAreaInsets();
  const { colors, mood, isDark } = useTheme();
  const { profile } = useProfile();

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 12 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ marginBottom: 14, alignItems: "center" }}>
            <EpheraWordmark size="sm" />
          </View>
          <Avatar size={72} editable onPress={() => go("settings")} />
          <IlluminatedText
            tone="tube"
            style={{ fontSize: 22, fontWeight: "700", marginTop: 12, letterSpacing: 0.4 }}
          >
            {profile.displayName}
          </IlluminatedText>
          <Text
            style={{
              color: colors.textMuted,
              marginTop: 4,
              fontSize: typography.caption,
              letterSpacing: 0.3,
            }}
          >
            {profile.handle}
          </Text>
          <View style={styles.badges}>
            <View
              style={[
                styles.badge,
                {
                  borderColor: colors.success,
                  backgroundColor: "rgba(52,211,153,0.12)",
                },
              ]}
            >
              <Text style={{ color: colors.success, fontSize: 11, fontWeight: "700" }}>
                ✓ {profile.kycTier}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  borderColor: mood.edge,
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                },
              ]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                {profile.country} · {profile.currency}
              </Text>
            </View>
          </View>
        </View>

        {SECTIONS.map((sec) => (
          <View key={sec.title} style={{ marginBottom: 16 }}>
            <Text
              style={[
                styles.sec,
                {
                  color: isDark ? mood.tube : colors.textDim,
                  textShadowColor: isDark ? mood.halo : "transparent",
                  textShadowRadius: isDark ? 6 : 0,
                  textShadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              {sec.title}
            </Text>
            <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
              {sec.items.map((item, i) => (
                <Pressable
                  key={item.title}
                  onPress={() => go(item.go)}
                  style={({ pressed }) => [
                    styles.row,
                    i < sec.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <IconWell name={item.icon} size={40} tone={item.tone ?? "tube"} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isDark ? mood.textGlow : colors.text,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      {item.title}
                    </Text>
                    {item.sub ? (
                      <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                        {item.sub}
                      </Text>
                    ) : null}
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
  hero: { alignItems: "center", marginBottom: 22, marginTop: 4 },
  name: { ...typeStyles.screenTitle, marginTop: 12 },
  badges: { flexDirection: "row", gap: 8, marginTop: 12 },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sec: {
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
