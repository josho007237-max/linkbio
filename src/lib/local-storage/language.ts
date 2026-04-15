"use client";

import { AppLanguage } from "@/i18n";

const APP_LANGUAGE_KEY = "linkbio-app-language-v1";
const LANGUAGE_EVENT = "linkbio-language-change";

export const getAppLanguage = (): AppLanguage => {
  if (typeof window === "undefined") {
    return "en";
  }
  const value = window.localStorage.getItem(APP_LANGUAGE_KEY);
  return value === "th" ? "th" : "en";
};

export const setAppLanguage = (language: AppLanguage): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(APP_LANGUAGE_KEY, language);
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
  window.dispatchEvent(new Event("storage"));
};

export { APP_LANGUAGE_KEY, LANGUAGE_EVENT };
