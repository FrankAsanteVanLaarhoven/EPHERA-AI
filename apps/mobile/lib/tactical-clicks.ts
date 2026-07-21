/**
 * Tactical / pack-based click player.
 * - 3 built-in packs: military · soft · cyber
 * - Custom uploaded URI
 * - Per-service category gates
 */
import { Audio } from "expo-av";
import type { SoundPackId, SoundServiceId, ServiceMap } from "./sound-prefs";

export type TacticalClick =
  | "ui_tap"
  | "ui_nav"
  | "ui_back"
  | "ui_tab"
  | "ui_toggle"
  | "tx_send"
  | "tx_receive"
  | "tx_scan"
  | "tx_crossborder"
  | "tx_cashout"
  | "svc_bills"
  | "svc_airtime"
  | "svc_merchant"
  | "svc_accounts"
  | "svc_cards"
  | "svc_savings"
  | "svc_invest"
  | "svc_exchange"
  | "sec_auth"
  | "sec_warn"
  | "sec_freeze"
  | "ok_confirm"
  | "ok_settled"
  | "err_fail"
  | "voice_open";

/** Map each click → service category for client toggles */
export const CLICK_SERVICE: Record<TacticalClick, SoundServiceId> = {
  ui_tap: "ui",
  ui_nav: "ui",
  ui_back: "ui",
  ui_tab: "ui",
  ui_toggle: "ui",
  tx_send: "transactions",
  tx_receive: "transactions",
  tx_scan: "transactions",
  tx_crossborder: "transactions",
  tx_cashout: "transactions",
  svc_bills: "payments",
  svc_airtime: "payments",
  svc_merchant: "payments",
  svc_accounts: "money",
  svc_cards: "money",
  svc_savings: "money",
  svc_invest: "money",
  svc_exchange: "money",
  sec_auth: "security",
  sec_warn: "security",
  sec_freeze: "security",
  ok_confirm: "outcomes",
  ok_settled: "outcomes",
  err_fail: "outcomes",
  voice_open: "voice",
};

export const CLICK_LABELS: Record<TacticalClick, string> = {
  ui_tap: "General tap",
  ui_nav: "Navigate",
  ui_back: "Back",
  ui_tab: "Tab switch",
  ui_toggle: "Toggle",
  tx_send: "Send money",
  tx_receive: "Receive",
  tx_scan: "Scan QR",
  tx_crossborder: "Cross-border",
  tx_cashout: "Cash out",
  svc_bills: "Bills",
  svc_airtime: "Airtime",
  svc_merchant: "Merchant",
  svc_accounts: "Accounts",
  svc_cards: "Cards",
  svc_savings: "Savings",
  svc_invest: "Invest",
  svc_exchange: "Exchange",
  sec_auth: "Authorise",
  sec_warn: "Security warning",
  sec_freeze: "Emergency freeze",
  ok_confirm: "Confirm",
  ok_settled: "Payment settled",
  err_fail: "Failed",
  voice_open: "Voice mode",
};

const MILITARY: Record<TacticalClick, number> = {
  ui_tap: require("../assets/sounds/ui_tap.wav"),
  ui_nav: require("../assets/sounds/ui_nav.wav"),
  ui_back: require("../assets/sounds/ui_back.wav"),
  ui_tab: require("../assets/sounds/ui_tab.wav"),
  ui_toggle: require("../assets/sounds/ui_toggle.wav"),
  tx_send: require("../assets/sounds/tx_send.wav"),
  tx_receive: require("../assets/sounds/tx_receive.wav"),
  tx_scan: require("../assets/sounds/tx_scan.wav"),
  tx_crossborder: require("../assets/sounds/tx_crossborder.wav"),
  tx_cashout: require("../assets/sounds/tx_cashout.wav"),
  svc_bills: require("../assets/sounds/svc_bills.wav"),
  svc_airtime: require("../assets/sounds/svc_airtime.wav"),
  svc_merchant: require("../assets/sounds/svc_merchant.wav"),
  svc_accounts: require("../assets/sounds/svc_accounts.wav"),
  svc_cards: require("../assets/sounds/svc_cards.wav"),
  svc_savings: require("../assets/sounds/svc_savings.wav"),
  svc_invest: require("../assets/sounds/svc_invest.wav"),
  svc_exchange: require("../assets/sounds/svc_exchange.wav"),
  sec_auth: require("../assets/sounds/sec_auth.wav"),
  sec_warn: require("../assets/sounds/sec_warn.wav"),
  sec_freeze: require("../assets/sounds/sec_freeze.wav"),
  ok_confirm: require("../assets/sounds/ok_confirm.wav"),
  ok_settled: require("../assets/sounds/ok_settled.wav"),
  err_fail: require("../assets/sounds/err_fail.wav"),
  voice_open: require("../assets/sounds/voice_open.wav"),
};

const SOFT: Record<TacticalClick, number> = {
  ui_tap: require("../assets/sounds/soft/ui_tap.wav"),
  ui_nav: require("../assets/sounds/soft/ui_nav.wav"),
  ui_back: require("../assets/sounds/soft/ui_back.wav"),
  ui_tab: require("../assets/sounds/soft/ui_tab.wav"),
  ui_toggle: require("../assets/sounds/soft/ui_toggle.wav"),
  tx_send: require("../assets/sounds/soft/tx_send.wav"),
  tx_receive: require("../assets/sounds/soft/tx_receive.wav"),
  tx_scan: require("../assets/sounds/soft/tx_scan.wav"),
  tx_crossborder: require("../assets/sounds/soft/tx_crossborder.wav"),
  tx_cashout: require("../assets/sounds/soft/tx_cashout.wav"),
  svc_bills: require("../assets/sounds/soft/svc_bills.wav"),
  svc_airtime: require("../assets/sounds/soft/svc_airtime.wav"),
  svc_merchant: require("../assets/sounds/soft/svc_merchant.wav"),
  svc_accounts: require("../assets/sounds/soft/svc_accounts.wav"),
  svc_cards: require("../assets/sounds/soft/svc_cards.wav"),
  svc_savings: require("../assets/sounds/soft/svc_savings.wav"),
  svc_invest: require("../assets/sounds/soft/svc_invest.wav"),
  svc_exchange: require("../assets/sounds/soft/svc_exchange.wav"),
  sec_auth: require("../assets/sounds/soft/sec_auth.wav"),
  sec_warn: require("../assets/sounds/soft/sec_warn.wav"),
  sec_freeze: require("../assets/sounds/soft/sec_freeze.wav"),
  ok_confirm: require("../assets/sounds/soft/ok_confirm.wav"),
  ok_settled: require("../assets/sounds/soft/ok_settled.wav"),
  err_fail: require("../assets/sounds/soft/err_fail.wav"),
  voice_open: require("../assets/sounds/soft/voice_open.wav"),
};

const CYBER: Record<TacticalClick, number> = {
  ui_tap: require("../assets/sounds/cyber/ui_tap.wav"),
  ui_nav: require("../assets/sounds/cyber/ui_nav.wav"),
  ui_back: require("../assets/sounds/cyber/ui_back.wav"),
  ui_tab: require("../assets/sounds/cyber/ui_tab.wav"),
  ui_toggle: require("../assets/sounds/cyber/ui_toggle.wav"),
  tx_send: require("../assets/sounds/cyber/tx_send.wav"),
  tx_receive: require("../assets/sounds/cyber/tx_receive.wav"),
  tx_scan: require("../assets/sounds/cyber/tx_scan.wav"),
  tx_crossborder: require("../assets/sounds/cyber/tx_crossborder.wav"),
  tx_cashout: require("../assets/sounds/cyber/tx_cashout.wav"),
  svc_bills: require("../assets/sounds/cyber/svc_bills.wav"),
  svc_airtime: require("../assets/sounds/cyber/svc_airtime.wav"),
  svc_merchant: require("../assets/sounds/cyber/svc_merchant.wav"),
  svc_accounts: require("../assets/sounds/cyber/svc_accounts.wav"),
  svc_cards: require("../assets/sounds/cyber/svc_cards.wav"),
  svc_savings: require("../assets/sounds/cyber/svc_savings.wav"),
  svc_invest: require("../assets/sounds/cyber/svc_invest.wav"),
  svc_exchange: require("../assets/sounds/cyber/svc_exchange.wav"),
  sec_auth: require("../assets/sounds/cyber/sec_auth.wav"),
  sec_warn: require("../assets/sounds/cyber/sec_warn.wav"),
  sec_freeze: require("../assets/sounds/cyber/sec_freeze.wav"),
  ok_confirm: require("../assets/sounds/cyber/ok_confirm.wav"),
  ok_settled: require("../assets/sounds/cyber/ok_settled.wav"),
  err_fail: require("../assets/sounds/cyber/err_fail.wav"),
  voice_open: require("../assets/sounds/cyber/voice_open.wav"),
};

const PACK_SOURCES: Record<Exclude<SoundPackId, "custom">, Record<TacticalClick, number>> = {
  military: MILITARY,
  soft: SOFT,
  cyber: CYBER,
};

export function clickForRoute(route: string): TacticalClick {
  switch (route) {
    case "send":
      return "tx_send";
    case "receive":
      return "tx_receive";
    case "scan":
      return "tx_scan";
    case "crossBorder":
      return "tx_crossborder";
    case "bills":
      return "svc_bills";
    case "airtime":
      return "svc_airtime";
    case "merchant":
      return "svc_merchant";
    case "accounts":
      return "svc_accounts";
    case "cards":
      return "svc_cards";
    case "savings":
      return "svc_savings";
    case "invest":
      return "svc_invest";
    case "exchange":
      return "svc_exchange";
    case "freeze":
      return "sec_freeze";
    case "security":
      return "sec_warn";
    case "voice":
    case "listening":
    case "voiceMode":
      return "voice_open";
    case "receipt":
      return "ok_settled";
    case "failedPayment":
      return "err_fail";
    default:
      return "ui_nav";
  }
}

type RuntimeConfig = {
  enabled: boolean;
  pack: SoundPackId;
  services: ServiceMap;
  customUri: string | null;
};

let config: RuntimeConfig = {
  enabled: true,
  pack: "military",
  services: {
    ui: true,
    transactions: true,
    payments: true,
    money: true,
    security: true,
    outcomes: true,
    voice: true,
  },
  customUri: null,
};

let modeReady = false;
/** Cache key = pack + click id (or custom uri) */
const cache = new Map<string, Audio.Sound>();

export function configureTacticalAudio(next: Partial<RuntimeConfig>) {
  const packChanged = next.pack !== undefined && next.pack !== config.pack;
  const customChanged =
    next.customUri !== undefined && next.customUri !== config.customUri;
  config = { ...config, ...next };
  if (packChanged || customChanged) {
    // Drop cached sounds so next play loads the new pack
    void unloadCache();
  }
}

/** @deprecated use configureTacticalAudio */
export function setTacticalClicksEnabled(on: boolean) {
  config.enabled = on;
}

async function unloadCache() {
  for (const s of cache.values()) {
    try {
      await s.unloadAsync();
    } catch {
      /* ignore */
    }
  }
  cache.clear();
}

async function ensureMode() {
  if (modeReady) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    modeReady = true;
  } catch {
    /* restricted */
  }
}

function sourceFor(kind: TacticalClick): number | { uri: string } {
  if (config.pack === "custom" && config.customUri) {
    return { uri: config.customUri };
  }
  const pack = config.pack === "custom" ? "military" : config.pack;
  return PACK_SOURCES[pack][kind];
}

/**
 * Fire a click if master + service category enabled.
 */
export async function tacticalClick(kind: TacticalClick = "ui_tap") {
  if (!config.enabled) return;
  const service = CLICK_SERVICE[kind];
  if (!config.services[service]) return;

  try {
    await ensureMode();
    const packKey =
      config.pack === "custom" && config.customUri
        ? `custom:${config.customUri}`
        : `${config.pack}:${kind}`;
    let sound = cache.get(packKey);
    if (!sound) {
      const src = sourceFor(kind);
      const created = await Audio.Sound.createAsync(src, {
        shouldPlay: false,
        volume: config.pack === "custom" ? 0.65 : 0.55,
        isLooping: false,
      });
      sound = created.sound;
      cache.set(packKey, sound);
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    /* silent */
  }
}

/** Settings preview — respects pack/custom, ignores service filters */
export async function previewTacticalClick(kind: TacticalClick = "ui_tap") {
  const prevEnabled = config.enabled;
  const prevServices = { ...config.services };
  config.enabled = true;
  (Object.keys(config.services) as SoundServiceId[]).forEach((k) => {
    config.services[k] = true;
  });
  await tacticalClick(kind);
  config.enabled = prevEnabled;
  config.services = prevServices;
}

export async function previewCustomUri(uri: string) {
  try {
    await ensureMode();
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 0.7 },
    );
    // unload after short play for music clips
    setTimeout(() => {
      void sound.unloadAsync();
    }, 2500);
  } catch {
    /* ignore */
  }
}
