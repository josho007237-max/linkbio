"use client";

export const safeJsonParse = <T>(raw: string | null | undefined, fallback: T): T => {
  if (typeof raw !== "string") {
    return fallback;
  }

  const normalized = raw.trim();
  if (!normalized) {
    return fallback;
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return fallback;
  }
};
