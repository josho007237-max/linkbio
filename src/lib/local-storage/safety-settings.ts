"use client";

const SAFETY_SETTINGS_KEY = "linkbio-safety-settings-v1";

export type SafetySettings = {
  enabled: boolean;
  pin: string;
};

const DEFAULT_SETTINGS: SafetySettings = {
  enabled: false,
  pin: "",
};

export const getSafetySettings = (): SafetySettings => {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SAFETY_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<SafetySettings>;
    return {
      enabled: Boolean(parsed.enabled),
      pin: typeof parsed.pin === "string" ? parsed.pin : "",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const setSafetySettings = (settings: SafetySettings): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SAFETY_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("storage"));
};

export const isSafetyPinValid = (inputPin: string): boolean => {
  const settings = getSafetySettings();
  if (!settings.enabled) {
    return true;
  }
  return settings.pin.length > 0 && settings.pin === inputPin;
};

export { SAFETY_SETTINGS_KEY };
