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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        header: state.header,
        theme: state.theme,
        text: state.text,
        buttonStyle: state.buttonStyle,
        socials: state.socials,
        links: state.links,
      }),
    },
  ),
);
