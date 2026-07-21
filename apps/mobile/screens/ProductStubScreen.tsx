import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassCard, IconWell, PrimaryButton, type IconName } from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

type Item = { icon: IconName; title: string; sub?: string };

const COPY: Record<
  string,
  { title: string; subtitle: string; items: Item[]; note: string }
> = {
  cards: {
    title: "Cards",
    subtitle: "Virtual, physical, controls",
    items: [
      { icon: "card", title: "Virtual, physical, single-use, international" },
      { icon: "freeze", title: "Freeze, limits, country & MCC controls" },
      { icon: "lock", title: "Secure reveal · report stolen · replace" },
      { icon: "device", title: "Apple Wallet / Google Wallet (device build)" },
    ],
    note: "Card issuance requires local licensing. Controls and statements ship with core.",
  },
  savings: {
    title: "Savings",
    subtitle: "Practical goals, not speculation",
    items: [
      { icon: "home", title: "Emergency fund · goal-based pots" },
      { icon: "refresh", title: "Round-ups · scheduled deposits" },
      { icon: "family", title: "Family circles · education · travel" },
      { icon: "lock", title: "Locked savings with clear withdrawal rules" },
    ],
    note: "Each goal shows target, time remaining, suggested contribution and rules.",
  },
  insurance: {
    title: "Insurance",
    subtitle: "Simple cover, clear exclusions",
    items: [
      { icon: "device", title: "Device · hospital cash · travel · funeral" },
      { icon: "merchant", title: "Merchant stock · weather · income interruption" },
      { icon: "receipt", title: "Monthly cost, coverage, waiting period" },
      { icon: "book", title: "Claim conditions and cancellation in plain language" },
    ],
    note: "No glossy hide-and-seek with legal terms.",
  },
  credit: {
    title: "Responsible credit",
    subtitle: "Full repayment before you accept",
    items: [
      { icon: "chart", title: "Eligibility & affordability estimate" },
      { icon: "receipt", title: "Total repayment · interest · fees · schedule" },
      { icon: "clock", title: "Early repayment · missed-payment consequences" },
      { icon: "support", title: "Request human review" },
    ],
    note: "Never only “You qualify for X.” Full cost of credit is mandatory.",
  },
  merchant: {
    title: "Merchant payments",
    subtitle: "Pay and get paid",
    items: [
      { icon: "qr", title: "Scan QR · tap · payment link · split" },
      { icon: "refund", title: "Request refund · merchant receipt" },
      { icon: "building", title: "Business mode: accept, invoice, settle, staff" },
    ],
    note: "Business tools live in a separate mode once KYB is complete.",
  },
  exchange: {
    title: "Exchange",
    subtitle: "Indicative rates, full markup",
    items: [
      { icon: "exchange", title: "Live rates · convert · rate alerts" },
      { icon: "insights", title: "Historical view · total markup" },
      { icon: "globe", title: "Cross-border route comparison" },
      { icon: "clock", title: "Travel currency · scheduled conversion" },
    ],
    note: "No speculative trading language without the right licences.",
  },
  family: {
    title: "Family & shared money",
    subtitle: "Transparent, consensual controls",
    items: [
      { icon: "family", title: "Family wallet · dependent accounts" },
      { icon: "school", title: "Allowances · school-fee wallet" },
      { icon: "receipt", title: "Shared bills · diaspora support" },
      { icon: "lock", title: "Restricted-purpose transfers with clear rules" },
    ],
    note: "Example: “School fees and transport only” — always visible to all parties.",
  },
  insights: {
    title: "Insights",
    subtitle: "Understandable, not generic charts",
    items: [
      { icon: "chart", title: "Income, spending, cash-flow forecast" },
      { icon: "refresh", title: "Subscriptions · fee summary · unusual activity" },
      { icon: "info", title: "Every recommendation explains why and data used" },
    ],
    note: "Recommendations are never silent or sponsored without a label.",
  },
  identity: {
    title: "Identity & verification",
    subtitle: "Progressive tiers, clear reasons",
    items: [
      { icon: "passkey", title: "Current tier · available services · limits" },
      { icon: "book", title: "Documents for next tier · rejection reasons" },
      { icon: "support", title: "Human review · business KYB · source of funds" },
    ],
    note: "Users always see why more information is requested.",
  },
  disputes: {
    title: "Disputes",
    subtitle: "Case number + expected response",
    items: [
      { icon: "alert", title: "Transfer problems · fraud · chargebacks" },
      { icon: "refund", title: "Refunds · wrong rate · identity" },
      { icon: "ticket", title: "Case tracking with visible SLAs" },
    ],
    note: "Every case returns a reference and expected response period.",
  },
  accessibility: {
    title: "Accessibility",
    subtitle: "Standard app + voice mode",
    items: [
      { icon: "type", title: "Text size", sub: "High contrast · reduce motion" },
      { icon: "mic", title: "Screen reader", sub: "Voice speed · spoken confirmations" },
      { icon: "haptic", title: "Haptics", sub: "Simplified language · longer confirm time" },
      { icon: "call", title: "Telephone fallback", sub: "Always available support path" },
    ],
    note: "Preferences apply to pages and Ephera Voice Mode.",
  },
  notifications: {
    title: "Notifications",
    subtitle: "Ordinary vs action centre",
    items: [
      { icon: "bell", title: "Transactions · security · bills · verification" },
      { icon: "alert", title: "Action centre: only items needing you" },
      { icon: "check", title: "Confirm transfer · new device · failed payment" },
    ],
    note: "Action items never hide inside a noisy feed.",
  },
};

export default function ProductStubScreen({
  kind,
  back,
  go,
}: {
  kind: string;
  back: () => void;
  go: Go;
}) {
  const { colors } = useTheme();
  const meta = COPY[kind] ?? {
    title: kind,
    subtitle: "Coming with licence & stability",
    items: [{ icon: "info" as IconName, title: "Core payments ship first" }],
    note: "This area follows the first-release plan.",
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={meta.title} subtitle={meta.subtitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        <GlassCard style={{ paddingVertical: 6, paddingHorizontal: 6 }} halo>
          {meta.items.map((item, i) => (
            <View
              key={item.title}
              style={[
                styles.row,
                i < meta.items.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <IconWell name={item.icon} size={40} tone="tube" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14, lineHeight: 19 }}>
                  {item.title}
                </Text>
                {item.sub ? (
                  <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{item.sub}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </GlassCard>
        <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 14, marginBottom: 20 }}>
          {meta.note}
        </Text>
        <PrimaryButton label="Back to Money" variant="secondary" onPress={back} click="ui_back" />
        <View style={{ height: 10 }} />
        <PrimaryButton label="Open support" variant="ghost" onPress={() => go("support")} click="ui_nav" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
