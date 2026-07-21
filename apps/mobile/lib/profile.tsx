import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@ephera/profile/v1";

export type UserProfile = {
  displayName: string;
  handle: string;
  email: string;
  phone: string;
  /** Local file URI or remote URL for avatar */
  avatarUri: string | null;
  currency: "GHS" | "NGN" | "KES" | "USD";
  language: string;
  country: string;
  kycTier: "basic" | "verified" | "premium";
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: "Ephera Demo",
  handle: "@ephera.demo",
  email: "demo@ephera.money",
  phone: "+233 24 000 0000",
  avatarUri: null,
  currency: "GHS",
  language: "en",
  country: "GH",
  kycTier: "verified",
};

type ProfileContextValue = {
  profile: UserProfile;
  ready: boolean;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  setAvatarUri: (uri: string | null) => Promise<void>;
  resetProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<UserProfile>;
          setProfile({ ...DEFAULT_PROFILE, ...parsed });
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: UserProfile) => {
    setProfile(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* offline / storage full — keep in-memory */
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      await persist({ ...profile, ...patch });
    },
    [persist, profile],
  );

  const setAvatarUri = useCallback(
    async (uri: string | null) => {
      await persist({ ...profile, avatarUri: uri });
    },
    [persist, profile],
  );

  const resetProfile = useCallback(async () => {
    await persist(DEFAULT_PROFILE);
  }, [persist]);

  const value = useMemo(
    () => ({ profile, ready, updateProfile, setAvatarUri, resetProfile }),
    [profile, ready, updateProfile, setAvatarUri, resetProfile],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
