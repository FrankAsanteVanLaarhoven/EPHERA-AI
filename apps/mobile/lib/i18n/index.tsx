import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import allMessages from "./all-messages.json";

const STORAGE_KEY = "@ephera/locale/v1";

export type LocaleCode =
  | "en"
  | "fr"
  | "es"
  | "pt"
  | "ar"
  | "zh"
  | "hi"
  | "de"
  | "ja"
  | "ko"
  | "ru"
  | "it"
  | "nl"
  | "tr"
  | "pl"
  | "vi"
  | "th"
  | "id"
  | "sv"
  | "el"
  | "sw"
  | "ha"
  | "yo"
  | "ig"
  | "am"
  | "zu"
  | "xh"
  | "af"
  | "so"
  | "om"
  | "tw"
  | "wo"
  | "ln"
  | "rw"
  | "lg"
  | "sn"
  | "ny"
  | "ti"
  | "ff"
  | "bm";

export type LocaleMeta = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  group: "global" | "africa";
};

export const LOCALES: LocaleMeta[] = [
  { code: "en", nativeName: "English", englishName: "English", group: "global" },
  { code: "fr", nativeName: "Français", englishName: "French", group: "global" },
  { code: "es", nativeName: "Español", englishName: "Spanish", group: "global" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", group: "global" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", group: "global" },
  { code: "zh", nativeName: "中文", englishName: "Chinese", group: "global" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", group: "global" },
  { code: "de", nativeName: "Deutsch", englishName: "German", group: "global" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", group: "global" },
  { code: "ko", nativeName: "한국어", englishName: "Korean", group: "global" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", group: "global" },
  { code: "it", nativeName: "Italiano", englishName: "Italian", group: "global" },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch", group: "global" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish", group: "global" },
  { code: "pl", nativeName: "Polski", englishName: "Polish", group: "global" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese", group: "global" },
  { code: "th", nativeName: "ไทย", englishName: "Thai", group: "global" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", group: "global" },
  { code: "sv", nativeName: "Svenska", englishName: "Swedish", group: "global" },
  { code: "el", nativeName: "Ελληνικά", englishName: "Greek", group: "global" },
  { code: "sw", nativeName: "Kiswahili", englishName: "Swahili", group: "africa" },
  { code: "ha", nativeName: "Hausa", englishName: "Hausa", group: "africa" },
  { code: "yo", nativeName: "Yorùbá", englishName: "Yoruba", group: "africa" },
  { code: "ig", nativeName: "Igbo", englishName: "Igbo", group: "africa" },
  { code: "am", nativeName: "አማርኛ", englishName: "Amharic", group: "africa" },
  { code: "zu", nativeName: "isiZulu", englishName: "Zulu", group: "africa" },
  { code: "xh", nativeName: "isiXhosa", englishName: "Xhosa", group: "africa" },
  { code: "af", nativeName: "Afrikaans", englishName: "Afrikaans", group: "africa" },
  { code: "so", nativeName: "Soomaali", englishName: "Somali", group: "africa" },
  { code: "om", nativeName: "Afaan Oromoo", englishName: "Oromo", group: "africa" },
  { code: "tw", nativeName: "Twi", englishName: "Twi (Akan)", group: "africa" },
  { code: "wo", nativeName: "Wolof", englishName: "Wolof", group: "africa" },
  { code: "ln", nativeName: "Lingála", englishName: "Lingala", group: "africa" },
  { code: "rw", nativeName: "Ikinyarwanda", englishName: "Kinyarwanda", group: "africa" },
  { code: "lg", nativeName: "Luganda", englishName: "Luganda", group: "africa" },
  { code: "sn", nativeName: "chiShona", englishName: "Shona", group: "africa" },
  { code: "ny", nativeName: "Chichewa", englishName: "Chichewa", group: "africa" },
  { code: "ti", nativeName: "ትግርኛ", englishName: "Tigrinya", group: "africa" },
  { code: "ff", nativeName: "Fulfulde", englishName: "Fula", group: "africa" },
  { code: "bm", nativeName: "Bamanankan", englishName: "Bambara", group: "africa" },
];

type Dict = Record<string, string>;
const MESSAGES = allMessages as Record<string, Dict>;
const EN = MESSAGES.en ?? {};

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locales: LocaleMeta[];
  isRtl: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const RTL: Set<string> = new Set(["ar"]);

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("en");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && raw in MESSAGES && !cancelled) {
          setLocaleState(raw as LocaleCode);
        }
      } catch {
        /* keep en */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (code: LocaleCode) => {
    setLocaleState(code);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = MESSAGES[locale] ?? EN;
      const raw = dict[key] ?? EN[key] ?? key;
      return format(raw, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: LOCALES,
      isRtl: RTL.has(locale),
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
