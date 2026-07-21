import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassIconButton, IconWell, Screen, type IconName } from "../components/ui";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { space } from "../theme";
import type { Screen as Route } from "../App";

const ITEM_DEFS: {
  icon: IconName;
  titleKey: string;
  subKey: string;
  tone?: "tube" | "accent" | "success" | "cyan" | "warning";
  go: Route;
}[] = [
  { icon: "send", titleKey: "services.send", subKey: "services.sendSub", tone: "accent", go: "send" },
  { icon: "receive", titleKey: "services.receive", subKey: "services.receiveSub", tone: "success", go: "receive" },
  { icon: "bolt", titleKey: "services.bills", subKey: "services.billsSub", tone: "warning", go: "bills" },
  { icon: "phone", titleKey: "services.airtime", subKey: "services.airtimeSub", tone: "cyan", go: "airtime" },
  { icon: "home", titleKey: "services.savings", subKey: "services.savingsSub", tone: "success", go: "savings" },
  { icon: "chart", titleKey: "services.invest", subKey: "services.investSub", tone: "accent", go: "invest" },
  { icon: "credit", titleKey: "services.loans", subKey: "services.loansSub", go: "credit" },
  { icon: "shield", titleKey: "services.insurance", subKey: "services.insuranceSub", tone: "success", go: "insurance" },
  { icon: "card", titleKey: "services.cards", subKey: "services.cardsSub", tone: "warning", go: "cards" },
  { icon: "merchant", titleKey: "services.merchant", subKey: "services.merchantSub", go: "merchant" },
  { icon: "globe", titleKey: "services.remit", subKey: "services.remitSub", tone: "cyan", go: "crossBorder" },
  { icon: "mic", titleKey: "services.voice", subKey: "services.voiceSub", go: "voice" },
];

export default function ServicesScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, mood, isDark } = useTheme();
  const t = useT();

  const ITEMS = ITEM_DEFS.map((item) => ({
    ...item,
    title: t(item.titleKey),
    sub: t(item.subKey),
  }));

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 8, paddingHorizontal: space.lg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[styles.kicker, { color: colors.accentBright }]}>{t("services.kicker")}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t("services.title")}</Text>
        </View>
        <GlassIconButton iconName="close" onPress={back} size={34} label="Close" click="ui_back" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.title}
              style={[
                styles.tile,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.card,
                  borderColor: isDark ? mood.edge : colors.border,
                },
              ]}
              onPress={() => go(item.go)}
            >
              <IconWell name={item.icon} size={40} tone={item.tone ?? "tube"} />
              <Text style={[styles.tileTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.tileSub, { color: colors.textDim }]}>{item.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.profileLink, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.card, borderColor: colors.border }]}
          onPress={() => go("profile")}
        >
          <IconWell name="user" size={34} />
          <Text style={[styles.profileLinkText, { color: colors.accentBright }]}>
            {t("services.profileLink")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.profileLink, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.card, borderColor: colors.border }]}
          onPress={() => go("settings")}
        >
          <IconWell name="settings" size={34} />
          <Text style={[styles.profileLinkText, { color: colors.accentBright }]}>
            {t("settings.title")} · {t("settings.language")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.profileLink, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.card, borderColor: colors.border }]}
          onPress={() => go("freeze")}
        >
          <IconWell name="freeze" size={34} tone="danger" />
          <Text style={[styles.profileLinkText, { color: colors.danger }]}>
            {t("services.securityLink")}
          </Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "47%",
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    minHeight: 118,
  },
  tileTitle: { fontWeight: "700", fontSize: 13, marginTop: 10 },
  tileSub: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  profileLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileLinkText: { fontWeight: "600", fontSize: 14, flex: 1 },
});
