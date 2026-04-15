import { en } from "@/i18n/en";
import { th } from "@/i18n/th";

export const dictionaries = {
  en,
  th,
} as const;

export type AppLanguage = keyof typeof dictionaries;
export type TranslationKey = keyof typeof en;
