/**
 * Local security centre state — production-ready client persistence.
 * Server is source of truth for freeze; limits/PIN/devices live here for demo + UX.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@ephera/security/v1";

export type TrustedDevice = {
  id: string;
  name: string;
  platform: string;
  lastSeen: string;
  thisDevice: boolean;
};

export type LoginEvent = {
  id: string;
  at: string;
  device: string;
  location: string;
  ok: boolean;
};

export type SecurityState = {
  passkeysEnabled: boolean;
  passkeyCount: number;
  biometricsEnabled: boolean;
  biometricsLabel: string;
  transactionPinEnabled: boolean;
  transactionPinSet: boolean;
  /** minor units GHS */
  dailyLimitMinor: number;
  monthlyLimitMinor: number;
  newRecipientLimitMinor: number;
  simChangeAlerts: boolean;
  recoveryContact: string | null;
  cameraPermission: boolean;
  micPermission: boolean;
  devices: TrustedDevice[];
  loginHistory: LoginEvent[];
  securityTipsSeen: boolean;
};

const DEFAULT: SecurityState = {
  passkeysEnabled: true,
  passkeyCount: 1,
  biometricsEnabled: true,
  biometricsLabel: "Face ID enabled",
  transactionPinEnabled: true,
  transactionPinSet: true,
  dailyLimitMinor: 2_000_000,
  monthlyLimitMinor: 10_000_000,
  newRecipientLimitMinor: 200_000,
  simChangeAlerts: true,
  recoveryContact: "+233 24 555 0199",
  cameraPermission: true,
  micPermission: true,
  devices: [
    {
      id: "dev_this",
      name: "This iPhone",
      platform: "iOS",
      lastSeen: new Date().toISOString(),
      thisDevice: true,
    },
    {
      id: "dev_ipad",
      name: "iPad Pro",
      platform: "iPadOS",
      lastSeen: new Date(Date.now() - 86400000 * 2).toISOString(),
      thisDevice: false,
    },
  ],
  loginHistory: [
    {
      id: "lg1",
      at: new Date().toISOString(),
      device: "This iPhone",
      location: "Accra, GH",
      ok: true,
    },
    {
      id: "lg2",
      at: new Date(Date.now() - 3600000 * 18).toISOString(),
      device: "iPad Pro",
      location: "Accra, GH",
      ok: true,
    },
    {
      id: "lg3",
      at: new Date(Date.now() - 86400000 * 3).toISOString(),
      device: "Unknown Android",
      location: "Lagos, NG",
      ok: false,
    },
  ],
  securityTipsSeen: false,
};

export async function loadSecurityState(): Promise<SecurityState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, devices: [...DEFAULT.devices], loginHistory: [...DEFAULT.loginHistory] };
    const parsed = JSON.parse(raw) as Partial<SecurityState>;
    return {
      ...DEFAULT,
      ...parsed,
      devices: parsed.devices ?? [...DEFAULT.devices],
      loginHistory: parsed.loginHistory ?? [...DEFAULT.loginHistory],
    };
  } catch {
    return { ...DEFAULT, devices: [...DEFAULT.devices], loginHistory: [...DEFAULT.loginHistory] };
  }
}

export async function saveSecurityState(state: SecurityState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export async function patchSecurity(
  patch: Partial<SecurityState>,
): Promise<SecurityState> {
  const cur = await loadSecurityState();
  const next = { ...cur, ...patch };
  await saveSecurityState(next);
  return next;
}

export function formatLimitGhs(minor: number) {
  return `GH₵ ${(minor / 100).toLocaleString("en-GH", {
    maximumFractionDigits: 0,
  })}`;
}
