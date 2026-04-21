"use client";

import { useEffect, useMemo, useState } from "react";

import { AppLanguage, dictionaries, TranslationKey } from "@/i18n";
import { getAppLanguage, LANGUAGE_EVENT, setAppLanguage } from "@/lib/local-storage/language";

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
};

export const useI18n = () => {
  const [language, setLanguageState] = useState<AppLanguage>(() => getAppLanguage());

  useEffect(() => {
    const onSync = () => setLanguageState(getAppLanguage());
    window.addEventListener("storage", onSync);
    window.addEventListener(LANGUAGE_EVENT, onSync);
    return () => {
      window.removeEventListener("storage", onSync);
      window.removeEventListener(LANGUAGE_EVENT, onSync);
    };
  }, []);

  const dictionary = useMemo(() => dictionaries[language], [language]);

  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    interpolate(dictionary[key], params);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    setAppLanguage(nextLanguage);
  };

  return { language, setLanguage, t };
};
