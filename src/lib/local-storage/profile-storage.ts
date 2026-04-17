"use client";

import { BuilderData } from "@/features/builder/types";
import { safeJsonParse } from "@/lib/json/safe-json-parse";

const BUILDER_STORE_KEY = "linkbio-builder-store-v1";
const PROFILE_INDEX_KEY = "linkbio-profile-index-v1";
const ACTIVE_EDITOR_SLUG_KEY = "linkbio-active-editor-slug-v1";
const STORAGE_CLEANUP_MARKER_KEY = "linkbio-storage-cleanup-v1";
const DEV_PUBLIC_PAGES_API_PREFIX = "/api/public-pages";

type PersistedBuilderSnapshot = {
  state?: Partial<BuilderData>;
};

const MAX_PERSISTED_DATA_URL_LENGTH = 180_000;

export type SavedProfileRecord = {
  slug: string;
  data: BuilderData;
};

const sanitizeMaybePersistedDataUrl = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (!normalized.startsWith("data:image/")) {
    return normalized;
  }
  if (!normalized.includes(",")) {
    return "";
  }
  return normalized.length > MAX_PERSISTED_DATA_URL_LENGTH ? "" : normalized;
};

const sanitizeProfileForIndex = (profile: BuilderData): BuilderData => ({
  ...profile,
  header: {
    ...profile.header,
    avatarUrl: sanitizeMaybePersistedDataUrl(profile.header?.avatarUrl),
    heroImageUrl: sanitizeMaybePersistedDataUrl(profile.header?.heroImageUrl),
  },
  theme: {
    ...profile.theme,
    wallpaperUrl: sanitizeMaybePersistedDataUrl(profile.theme?.wallpaperUrl),
  },
  socials: profile.socials.map((social) => ({
    ...social,
    iconUrl: sanitizeMaybePersistedDataUrl(social?.iconUrl),
  })),
  links: profile.links.map((link) => ({
    ...link,
    settings: {
      ...link.settings,
      thumbnailUrl: sanitizeMaybePersistedDataUrl(link.settings?.thumbnailUrl),
    },
    discount: link.discount
      ? {
          ...link.discount,
          cardThumbnail: sanitizeMaybePersistedDataUrl(link.discount?.cardThumbnail),
          modalHeroImage: sanitizeMaybePersistedDataUrl(link.discount?.modalHeroImage),
        }
      : link.discount,
    embedPost: link.embedPost
      ? {
          ...link.embedPost,
          cardIcon: sanitizeMaybePersistedDataUrl(link.embedPost?.cardIcon),
          cardThumbnail: sanitizeMaybePersistedDataUrl(link.embedPost?.cardThumbnail),
        }
      : link.embedPost,
  })),
});

const isBuilderData = (value: unknown): value is BuilderData => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as BuilderData;
  return Boolean(
    data.header &&
      data.theme &&
      data.text &&
      data.buttonStyle &&
      Array.isArray(data.socials) &&
      Array.isArray(data.links),
  );
};

export const toProfileSlug = (username: string): string =>
  username.trim().toLowerCase();

const readJSON = <T>(key: string): T | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return safeJsonParse<T | null>(raw, null);
  } catch {
    return null;
  }
};

const writeJSON = (key: string, value: unknown): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized.trim()) {
      window.localStorage.removeItem(key);
      return false;
    }
    window.localStorage.setItem(key, serialized);
    return true;
  } catch {
    window.dispatchEvent(
      new CustomEvent("linkbio-storage-warning", {
        detail: {
          reason: "quota_or_storage_error",
          key,
        },
      }),
    );
    return false;
  }
};

const getStoredProfiles = (): Record<string, BuilderData> =>
  readJSON<Record<string, BuilderData>>(PROFILE_INDEX_KEY) ?? {};

const setStoredProfiles = (profiles: Record<string, BuilderData>): void => {
  writeJSON(PROFILE_INDEX_KEY, profiles);
};

const getBuilderStateFromPersist = (): BuilderData | null => {
  const persisted = readJSON<PersistedBuilderSnapshot>(BUILDER_STORE_KEY);
  if (!persisted?.state || !isBuilderData(persisted.state)) {
    return null;
  }
  return persisted.state;
};

export const upsertProfileIndex = (
  profile: BuilderData,
  previousSlug?: string,
): void => {
  const profiles = getStoredProfiles();
  const sanitizedProfile = sanitizeProfileForIndex(profile);
  const nextSlug = toProfileSlug(sanitizedProfile.header.username);

  if (previousSlug && previousSlug !== nextSlug) {
    delete profiles[previousSlug];
  }

  profiles[nextSlug] = sanitizedProfile;
  writeJSON(PROFILE_INDEX_KEY, profiles);
  if (typeof window !== "undefined") {
    void fetch(`${DEV_PUBLIC_PAGES_API_PREFIX}/${encodeURIComponent(nextSlug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: sanitizedProfile }),
    }).catch(() => undefined);
  }
};

export const getProfileBySlugFromLocal = (slug: string): BuilderData | null => {
  const normalizedSlug = toProfileSlug(slug);
  const profiles = getStoredProfiles();

  if (profiles[normalizedSlug]) {
    return profiles[normalizedSlug];
  }

  const activeBuilder = getBuilderStateFromPersist();
  if (
    activeBuilder &&
    toProfileSlug(activeBuilder.header.username) === normalizedSlug
  ) {
    return activeBuilder;
  }

  return null;
};

export const getProfileWithFallback = (slug: string): BuilderData | null =>
  getProfileBySlugFromLocal(slug);

export const getSavedProfilesFromLocal = (): SavedProfileRecord[] => {
  const profiles = getStoredProfiles();
  return Object.entries(profiles)
    .map(([slug, data]) => ({ slug, data }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
};

export const getSavedProfileBySlug = (slug: string): BuilderData | null => {
  const normalizedSlug = toProfileSlug(slug);
  const profiles = getStoredProfiles();
  return profiles[normalizedSlug] ?? null;
};

export const getActiveEditorSlug = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(ACTIVE_EDITOR_SLUG_KEY);
  } catch {
    return null;
  }
  return raw ? toProfileSlug(raw) : null;
};

export const setActiveEditorSlug = (slug: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(ACTIVE_EDITOR_SLUG_KEY, toProfileSlug(slug));
  } catch {
    return;
  }
  window.dispatchEvent(new Event("storage"));
};

export const removeProfileBySlug = (slug: string): void => {
  const normalizedSlug = toProfileSlug(slug);
  const profiles = getStoredProfiles();
  if (!profiles[normalizedSlug]) {
    return;
  }
  delete profiles[normalizedSlug];
  setStoredProfiles(profiles);
  if (typeof window !== "undefined") {
    void fetch(`${DEV_PUBLIC_PAGES_API_PREFIX}/${encodeURIComponent(normalizedSlug)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }
};

export const clearProfileIndex = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(PROFILE_INDEX_KEY);
  } catch {
    return;
  }
};

export const clearStaleLocalStorageKeysOnce = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const hasRun = window.localStorage.getItem(STORAGE_CLEANUP_MARKER_KEY);
    if (hasRun === "done") {
      return;
    }

    window.localStorage.removeItem(BUILDER_STORE_KEY);
    window.localStorage.removeItem(PROFILE_INDEX_KEY);
    window.localStorage.removeItem(ACTIVE_EDITOR_SLUG_KEY);
    window.localStorage.setItem(STORAGE_CLEANUP_MARKER_KEY, "done");
  } catch {
    return;
  }
};

export { BUILDER_STORE_KEY, PROFILE_INDEX_KEY };
export { ACTIVE_EDITOR_SLUG_KEY };
