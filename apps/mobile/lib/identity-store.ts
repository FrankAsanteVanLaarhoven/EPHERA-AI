import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@ephera/identity/v1";

export type KycTier = "basic" | "verified" | "premium";

export type IdentityDoc = {
  id: string;
  label: string;
  status: "missing" | "pending" | "approved" | "rejected";
  note?: string;
};

export type IdentityState = {
  tier: KycTier;
  fullName: string;
  nationalId: string | null;
  docs: IdentityDoc[];
  businessKyb: boolean;
  sourceOfFunds: string | null;
  lastReviewAt: string | null;
};

const DEFAULT: IdentityState = {
  tier: "verified",
  fullName: "Ephera Demo",
  nationalId: "GHA-••••-4421",
  docs: [
    { id: "id_card", label: "Government ID", status: "approved" },
    { id: "selfie", label: "Liveness selfie", status: "approved" },
    { id: "address", label: "Proof of address", status: "pending", note: "Under review · 1–2 days" },
    { id: "sof", label: "Source of funds", status: "missing", note: "Required for Premium" },
  ],
  businessKyb: false,
  sourceOfFunds: null,
  lastReviewAt: new Date(Date.now() - 86400000 * 5).toISOString(),
};

export async function loadIdentity(): Promise<IdentityState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, docs: DEFAULT.docs.map((d) => ({ ...d })) };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT, docs: DEFAULT.docs.map((d) => ({ ...d })) };
  }
}

export async function saveIdentity(state: IdentityState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export async function patchIdentity(patch: Partial<IdentityState>): Promise<IdentityState> {
  const cur = await loadIdentity();
  const next = { ...cur, ...patch };
  await saveIdentity(next);
  return next;
}

export function tierLimits(tier: KycTier) {
  switch (tier) {
    case "basic":
      return { daily: "GH₵ 1,000", send: "Local only", receive: "Yes" };
    case "verified":
      return { daily: "GH₵ 20,000", send: "Domestic + MoMo", receive: "Yes" };
    case "premium":
      return { daily: "GH₵ 100,000", send: "Cross-border", receive: "Yes" };
  }
}
