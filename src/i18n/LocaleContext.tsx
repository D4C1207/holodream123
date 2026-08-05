import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Attr } from "../types";
import {
  DEFAULT_LOCALE,
  LOCALES,
  MESSAGES,
  STORAGE_LOCALE,
  isLocale,
  type Locale,
  type Messages,
} from "./messages";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
  attrLabel: (attr: Attr) => string;
  paramLabel: (param: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_LOCALE);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_LOCALE, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const meta = LOCALES.find((l) => l.id === locale);
    document.documentElement.lang = meta?.htmlLang ?? "zh-Hant";
  }, [locale]);

  const t = MESSAGES[locale];

  const value = useMemo<I18nValue>(() => {
    const attrLabel = (attr: Attr) => {
      if (attr === "happy") return t.attrHappy;
      if (attr === "pure") return t.attrPure;
      return t.attrCute;
    };
    const paramLabel = (param: string) => {
      const key = param.toLowerCase();
      if (key.includes("perf") || param === "表演力" || param === "パフォーマンス") {
        return t.paramPerf;
      }
      if (key.includes("tech") || param === "技巧" || param === "テクニック") {
        return t.paramTech;
      }
      if (key.includes("sense") || param === "感性" || param === "センス") {
        return t.paramSense;
      }
      return param;
    };
    return { locale, setLocale, t, attrLabel, paramLabel };
  }, [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}
