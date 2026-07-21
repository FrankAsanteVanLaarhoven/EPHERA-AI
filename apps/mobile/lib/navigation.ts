/**
 * Product navigation model.
 * Tabs stay familiar; stack routes open full financial flows.
 * Voice mode is a modal overlay — never a primary tab.
 */

export type TabId = "home" | "payments" | "money" | "activity" | "profile";

/** Stack / modal routes (not bottom tabs). */
export type StackScreen =
  | "splash"
  | "welcome"
  | "voice"
  | "servicesDrawer"
  | "accounts"
  | "send"
  | "receive"
  | "scan"
  | "crossBorder"
  | "bills"
  | "airtime"
  | "cards"
  | "savings"
  | "insurance"
  | "credit"
  | "invest"
  | "merchant"
  | "receipt"
  | "failedPayment"
  | "disputes"
  | "security"
  | "identity"
  | "exchange"
  | "family"
  | "insights"
  | "notifications"
  | "settings"
  | "accessibility"
  | "freeze"
  | "support"
  | "board";

/** Canonical screen ids used by the shell. */
export type Screen = TabId | StackScreen;

/**
 * Legacy aliases still used by older screens.
 * Always resolve through `resolveScreen` before setState.
 */
export type ScreenAlias =
  | "listening"
  | "voiceMode"
  | "services"
  | "profile"
  | "activity"
  | "notifications";

/** Anything `go()` accepts. */
export type GoTarget = Screen | ScreenAlias;

const ALIASES: Record<ScreenAlias, Screen> = {
  listening: "voice",
  voiceMode: "voice",
  services: "servicesDrawer",
  profile: "profile",
  activity: "activity",
  notifications: "notifications",
};

export type Nav = {
  /** Active bottom tab when showing main shell */
  tab: TabId;
  /** Full-screen stack route; null = show tab content */
  stack: StackScreen | null;
  params?: Record<string, string>;
};

export const TABS: {
  id: TabId;
  label: string;
  /** Enterprise icon name (see components/icons/Icon) */
  icon: "home" | "exchange" | "wallet" | "insights" | "user";
}[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "payments", label: "Payments", icon: "exchange" },
  { id: "money", label: "Money", icon: "wallet" },
  { id: "activity", label: "Activity", icon: "insights" },
  { id: "profile", label: "Profile", icon: "user" },
];

export function isTab(s: string): s is TabId {
  return ["home", "payments", "money", "activity", "profile"].includes(s);
}

export function isStack(s: string): s is StackScreen {
  return (
    !isTab(s) &&
    [
      "splash",
      "welcome",
      "voice",
      "servicesDrawer",
      "accounts",
      "send",
      "receive",
      "scan",
      "crossBorder",
      "bills",
      "airtime",
      "cards",
      "savings",
      "insurance",
      "credit",
      "invest",
      "merchant",
      "receipt",
      "failedPayment",
      "disputes",
      "security",
      "identity",
      "exchange",
      "family",
      "insights",
      "notifications",
      "settings",
      "accessibility",
      "freeze",
      "support",
      "board",
    ].includes(s)
  );
}

/** Map aliases → canonical Screen. */
export function resolveScreen(target: GoTarget | string): Screen {
  if (target in ALIASES) return ALIASES[target as ScreenAlias];
  return target as Screen;
}
