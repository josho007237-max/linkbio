import { ThemeName } from "@/features/builder/types";

type BrandPresetTheme = {
  name: ThemeName;
  wallpaperUrl: string;
  pageBackground: string;
  cardBackground: string;
  textColor: string;
  mutedTextColor: string;
  buttonBackground: string;
  buttonTextColor: string;
  buttonRadius: number;
};

type BrandPresetSocialUrls = {
  instagram: string;
  youtube: string;
  x: string;
};

type BrandPresetButtonLabels = {
  primary: string;
  secondary: string;
  tertiary: string;
};

export type BrandPreset = {
  brandName: string;
  username: string;
  tagline: string;
  intro: string;
  body: string;
  avatarUrl: string;
  buttonLabels: BrandPresetButtonLabels;
  socialUrls: BrandPresetSocialUrls;
  theme: BrandPresetTheme;
};

export const defaultBrandPreset: BrandPreset = {
  brandName: "Northfield Studio",
  username: "northfieldstudio",
  tagline: "Creative strategy, digital design, and content systems for growing brands.",
  intro: "Start with the most important destination for your audience.",
  body: "Use this page to guide visitors to your services, booking flow, portfolio, and business updates.",
  avatarUrl: "/placeholders/avatar-default.svg",
  buttonLabels: {
    primary: "Book a Consultation",
    secondary: "Explore Services",
    tertiary: "Client Portal",
  },
  socialUrls: {
    instagram: "https://instagram.com",
    youtube: "https://youtube.com",
    x: "https://x.com",
  },
  theme: {
    name: "midnight",
    wallpaperUrl: "/placeholders/wallpaper-default.svg",
    pageBackground: "#0B1222",
    cardBackground: "rgba(17, 25, 40, 0.85)",
    textColor: "#F4F7FF",
    mutedTextColor: "#B8C2DB",
    buttonBackground: "#2563EB",
    buttonTextColor: "#EFF6FF",
    buttonRadius: 18,
  },
};
