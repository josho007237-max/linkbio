"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { mockBuilderData } from "@/features/builder/mock-data";
import { BuilderData, BuilderTheme, ButtonStyle, LinkSettings, ProfileHeader, ProfileText, SocialLink, BioLink } from "@/features/builder/types";
import { BUILDER_STORE_KEY } from "@/lib/local-storage/profile-storage";

type BuilderStore = BuilderData & {
  updateHeader: (payload: Partial<ProfileHeader>) => void;
  updateTheme: (payload: Partial<BuilderTheme>) => void;
  updateText: (payload: Partial<ProfileText>) => void;
  updateButtonStyle: (payload: Partial<ButtonStyle>) => void;
  addSocial: (payload?: Partial<SocialLink>) => void;
  updateSocial: (id: string, payload: Partial<SocialLink>) => void;
  deleteSocial: (id: string) => void;
  addLink: (link: BioLink) => void;
  updateLink: (id: string, payload: Partial<BioLink>) => void;
  updateLinkSettings: (id: string, payload: Partial<LinkSettings>) => void;
  deleteLink: (id: string) => void;
  reorderLinks: (activeId: string, overId: string) => void;
  toggleLink: (id: string, enabled: boolean) => void;
  replaceBuilderData: (payload: BuilderData) => void;
  resetBuilderData: () => void;
};

const MAX_PERSISTED_DATA_URL_LENGTH = 180_000;

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

const sanitizePersistedState = (state: BuilderStore) => {
  const socials = Array.isArray(state.socials) ? state.socials : [];
  const links = Array.isArray(state.links) ? state.links : [];

  return {
    header: {
      ...state.header,
      avatarUrl: sanitizeMaybePersistedDataUrl(state.header?.avatarUrl),
      heroImageUrl: sanitizeMaybePersistedDataUrl(state.header?.heroImageUrl),
    },
    theme: {
      ...state.theme,
      wallpaperUrl: sanitizeMaybePersistedDataUrl(state.theme?.wallpaperUrl),
    },
    text: state.text,
    buttonStyle: state.buttonStyle,
    socials: socials.map((social) => ({
      ...social,
      iconUrl: sanitizeMaybePersistedDataUrl(social?.iconUrl),
    })),
    links: links.map((link) => ({
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
  };
};

const buildMinimalPersistedState = (state: BuilderStore) => ({
  ...mockBuilderData,
  header: {
    ...mockBuilderData.header,
    username:
      typeof state.header?.username === "string" && state.header.username.trim()
        ? state.header.username.trim()
        : mockBuilderData.header.username,
    displayName:
      typeof state.header?.displayName === "string" && state.header.displayName.trim()
        ? state.header.displayName.trim()
        : mockBuilderData.header.displayName,
  },
});

const safePersistPartialize = (state: BuilderStore) => {
  try {
    return sanitizePersistedState(state);
  } catch {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("linkbio-storage-warning", {
          detail: {
            reason: "sanitize_persist_error",
            key: BUILDER_STORE_KEY,
          },
        }),
      );
    }
    return buildMinimalPersistedState(state);
  }
};

const guardedLocalStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (!value.trim()) {
        window.localStorage.removeItem(name);
        return;
      }
      window.localStorage.setItem(name, value);
    } catch {
      window.dispatchEvent(
        new CustomEvent("linkbio-storage-warning", {
          detail: {
            reason: "quota_or_storage_error",
            key: name,
          },
        }),
      );
      return;
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.removeItem(name);
    } catch {
      return;
    }
  },
};

const mergeLinkSettings = (current: BioLink, next: Partial<LinkSettings>): LinkSettings => ({
  ...current.settings,
  ...next,
  schedule:
    next.schedule === undefined
      ? current.settings.schedule
      : {
          ...current.settings.schedule,
          ...next.schedule,
        },
});

export const useBuilderStore = create<BuilderStore>()(
  persist(
    (set) => ({
      ...mockBuilderData,
      updateHeader: (payload) =>
        set((state) => ({
          header: {
            ...state.header,
            ...payload,
          },
        })),
      updateTheme: (payload) =>
        set((state) => ({
          theme: {
            ...state.theme,
            ...payload,
          },
        })),
      updateText: (payload) =>
        set((state) => ({
          text: {
            ...state.text,
            ...payload,
          },
        })),
      updateButtonStyle: (payload) =>
        set((state) => ({
          buttonStyle: {
            ...state.buttonStyle,
            ...payload,
          },
        })),
      addSocial: (payload) =>
        set((state) => ({
          socials: [
            ...state.socials,
            {
              id: `social-${Math.random().toString(36).slice(2, 9)}`,
              platform: "website",
              url: "https://",
              enabled: true,
              ...payload,
            },
          ],
        })),
      updateSocial: (id, payload) =>
        set((state) => ({
          socials: state.socials.map((social) =>
            social.id === id ? { ...social, ...payload } : social,
          ),
        })),
      deleteSocial: (id) =>
        set((state) => ({
          socials: state.socials.filter((social) => social.id !== id),
        })),
      addLink: (link) =>
        set((state) => ({
          links: [...state.links, link],
        })),
      updateLink: (id, payload) =>
        set((state) => ({
          links: state.links.map((link) =>
            link.id === id ? { ...link, ...payload } : link,
          ),
        })),
      updateLinkSettings: (id, payload) =>
        set((state) => ({
          links: state.links.map((link) =>
            link.id === id
              ? {
                  ...link,
                  settings: mergeLinkSettings(link, payload),
                }
              : link,
          ),
        })),
      deleteLink: (id) =>
        set((state) => ({
          links: state.links.filter((link) => link.id !== id),
        })),
      reorderLinks: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.links.findIndex((link) => link.id === activeId);
          const newIndex = state.links.findIndex((link) => link.id === overId);

          if (oldIndex < 0 || newIndex < 0) {
            return state;
          }

          return {
            links: arrayMove(state.links, oldIndex, newIndex),
          };
        }),
      toggleLink: (id, enabled) =>
        set((state) => ({
          links: state.links.map((link) =>
            link.id === id ? { ...link, enabled } : link,
          ),
        })),
      replaceBuilderData: (payload) =>
        set(() => ({
          ...payload,
        })),
      resetBuilderData: () =>
        set(() => ({
          ...mockBuilderData,
        })),
    }),
    {
      name: BUILDER_STORE_KEY,
      storage: createJSONStorage(() => guardedLocalStorage),
      partialize: safePersistPartialize,
    },
  ),
);
