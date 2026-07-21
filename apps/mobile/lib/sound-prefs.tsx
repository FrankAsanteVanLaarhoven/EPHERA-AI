/**
 * Client sound preferences:
 * - Master on/off
 * - Sound pack (military / soft / cyber / custom)
 * - Per-service category toggles
 * - Custom uploaded sound URI
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@ephera/sound/prefs/v2";

export type SoundPackId = "military" | "soft" | "cyber" | "custom";

/** Groups of actions the client can enable independently */
export type SoundServiceId =
  | "ui"
  | "transactions"
  | "payments"
  | "money"
  | "security"
  | "outcomes"
  | "voice";

export const SOUND_SERVICES: {
  id: SoundServiceId;
  label: string;
  description: string;
}[] = [
  { id: "ui", label: "Interface", description: "Taps, tabs, back, navigation" },
  { id: "transactions", label: "Transfers", description: "Send, receive, scan, cash out, cross-border" },
  { id: "payments", label: "Pay for things", description: "Bills, airtime, merchant" },
  { id: "money", label: "Money products", description: "Accounts, cards, savings, invest, exchange" },
  { id: "security", label: "Security", description: "Authorise, warnings, freeze" },
  { id: "outcomes", label: "Results", description: "Success, settled, failed" },
  { id: "voice", label: "Voice mode", description: "Open voice operator" },
];

export const SOUND_PACKS: {
  id: SoundPackId;
  label: string;
  description: string;
}[] = [
  {
    id: "military",
    label: "Military keys",
    description: "Sharp tactical keyboard clicks",
  },
  {
    id: "soft",
    label: "Soft glass",
    description: "Calm, low glass-panel ticks",
  },
  {
    id: "cyber",
    label: "Cyber HUD",
    description: "Digital blips for control panels",
  },
  {
    id: "custom",
    label: "Custom upload",
    description: "Your sound or music for every click",
  },
];

export type ServiceMap = Record<SoundServiceId, boolean>;

const DEFAULT_SERVICES: ServiceMap = {
  ui: true,
  transactions: true,
  payments: true,
  money: true,
  security: true,
  outcomes: true,
  voice: true,
};

export type SoundPrefsState = {
  /** Master switch for all click feedback */
  tacticalClicks: boolean;
  brandSonic: boolean;
  pack: SoundPackId;
  services: ServiceMap;
  /** Local file URI for custom pack (documentDirectory copy) */
  customUri: string | null;
  customName: string | null;
};

type SoundPrefsApi = SoundPrefsState & {
  setTacticalClicks: (on: boolean) => Promise<void>;
  setBrandSonic: (on: boolean) => Promise<void>;
  setPack: (pack: SoundPackId) => Promise<void>;
  setServiceEnabled: (id: SoundServiceId, on: boolean) => Promise<void>;
  setAllServices: (on: boolean) => Promise<void>;
  setCustomSound: (uri: string, name: string) => Promise<void>;
  clearCustomSound: () => Promise<void>;
  ready: boolean;
};

const Ctx = createContext<SoundPrefsApi | null>(null);

async function persist(state: SoundPrefsState) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function SoundPrefsProvider({ children }: { children: React.ReactNode }) {
  const [tacticalClicks, setClicksState] = useState(true);
  const [brandSonic, setSonicState] = useState(true);
  const [pack, setPackState] = useState<SoundPackId>("military");
  const [services, setServicesState] = useState<ServiceMap>(DEFAULT_SERVICES);
  const [customUri, setCustomUri] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw && !cancelled) {
          const data = JSON.parse(raw) as Partial<SoundPrefsState>;
          if (typeof data.tacticalClicks === "boolean") setClicksState(data.tacticalClicks);
          if (typeof data.brandSonic === "boolean") setSonicState(data.brandSonic);
          if (data.pack) setPackState(data.pack);
          if (data.services) setServicesState({ ...DEFAULT_SERVICES, ...data.services });
          if (data.customUri) setCustomUri(data.customUri);
          if (data.customName) setCustomName(data.customName);
        }
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useCallback(
    (over: Partial<SoundPrefsState> = {}): SoundPrefsState => ({
      tacticalClicks,
      brandSonic,
      pack,
      services,
      customUri,
      customName,
      ...over,
    }),
    [tacticalClicks, brandSonic, pack, services, customUri, customName],
  );

  const setTacticalClicks = useCallback(
    async (on: boolean) => {
      setClicksState(on);
      await persist(snapshot({ tacticalClicks: on }));
    },
    [snapshot],
  );

  const setBrandSonic = useCallback(
    async (on: boolean) => {
      setSonicState(on);
      await persist(snapshot({ brandSonic: on }));
    },
    [snapshot],
  );

  const setPack = useCallback(
    async (next: SoundPackId) => {
      setPackState(next);
      await persist(snapshot({ pack: next }));
    },
    [snapshot],
  );

  const setServiceEnabled = useCallback(
    async (id: SoundServiceId, on: boolean) => {
      const next = { ...services, [id]: on };
      setServicesState(next);
      await persist(snapshot({ services: next }));
    },
    [services, snapshot],
  );

  const setAllServices = useCallback(
    async (on: boolean) => {
      const next = { ...DEFAULT_SERVICES };
      (Object.keys(next) as SoundServiceId[]).forEach((k) => {
        next[k] = on;
      });
      setServicesState(next);
      await persist(snapshot({ services: next }));
    },
    [snapshot],
  );

  const setCustomSound = useCallback(
    async (uri: string, name: string) => {
      setCustomUri(uri);
      setCustomName(name);
      setPackState("custom");
      await persist(
        snapshot({ customUri: uri, customName: name, pack: "custom" }),
      );
    },
    [snapshot],
  );

  const clearCustomSound = useCallback(async () => {
    setCustomUri(null);
    setCustomName(null);
    const nextPack: SoundPackId = pack === "custom" ? "military" : pack;
    setPackState(nextPack);
    await persist(
      snapshot({ customUri: null, customName: null, pack: nextPack }),
    );
  }, [pack, snapshot]);

  const value = useMemo(
    () => ({
      tacticalClicks,
      brandSonic,
      pack,
      services,
      customUri,
      customName,
      setTacticalClicks,
      setBrandSonic,
      setPack,
      setServiceEnabled,
      setAllServices,
      setCustomSound,
      clearCustomSound,
      ready,
    }),
    [
      tacticalClicks,
      brandSonic,
      pack,
      services,
      customUri,
      customName,
      setTacticalClicks,
      setBrandSonic,
      setPack,
      setServiceEnabled,
      setAllServices,
      setCustomSound,
      clearCustomSound,
      ready,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSoundPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      tacticalClicks: true,
      brandSonic: true,
      pack: "military" as SoundPackId,
      services: DEFAULT_SERVICES,
      customUri: null,
      customName: null,
      setTacticalClicks: async () => {},
      setBrandSonic: async () => {},
      setPack: async () => {},
      setServiceEnabled: async () => {},
      setAllServices: async () => {},
      setCustomSound: async () => {},
      clearCustomSound: async () => {},
      ready: true,
    } satisfies SoundPrefsApi;
  }
  return ctx;
}
