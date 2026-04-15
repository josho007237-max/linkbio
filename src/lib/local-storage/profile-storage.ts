"use client";

import { BuilderData } from "@/features/builder/types";

const BUILDER_STORE_KEY = "linkbio-builder-store-v1";
const PROFILE_INDEX_KEY = "linkbio-profile-index-v1";
const ACTIVE_EDITOR_SLUG_KEY = "linkbio-active-editor-slug-v1";

type PersistedBuilderSnapshot = {
  state?: Partial<BuilderData>;
};

export type SavedProfileRecord = {
  slug: string;
  data: BuilderData;
};

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
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJSON = (key: string, value: unknown): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
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
  const nextSlug = toProfileSlug(profile.header.username);

  if (previousSlug && previousSlug !== nextSlug) {
    delete profiles[previousSlug];
  }

  profiles[nextSlug] = profile;
  writeJSON(PROFILE_INDEX_KEY, profiles);
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
  const raw = window.localStorage.getItem(ACTIVE_EDITOR_SLUG_KEY);
  return raw ? toProfileSlug(raw) : null;
};

export const setActiveEditorSlug = (slug: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACTIVE_EDITOR_SLUG_KEY, toProfileSlug(slug));
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
};

export const clearProfileIndex = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PROFILE_INDEX_KEY);
};

export { BUILDER_STORE_KEY, PROFILE_INDEX_KEY };
export { ACTIVE_EDITOR_SLUG_KEY };
