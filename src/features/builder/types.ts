export type ThemeName = "midnight" | "sunset" | "forest";

export type BuilderTheme = {
  name: ThemeName;
  wallpaperUrl: string;
  wallpaperVideoUrl?: string;
  wallpaperStyle?: "fill" | "gradient" | "blur" | "pattern" | "image" | "video";
  pageBackground: string;
  cardBackground: string;
  textColor: string;
  mutedTextColor: string;
  titleColor?: string;
  titleSize?: number;
  pageFont?: "inter" | "poppins" | "manrope" | "space_grotesk";
  buttonBackground: string;
  buttonTextColor: string;
  buttonRadius: number;
};

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "facebook"
  | "website";

export type SocialLink = {
  id: string;
  platform: SocialPlatform;
  url: string;
  enabled: boolean;
  iconUrl?: string;
};

export type LinkSchedule = {
  startAt?: string;
  endAt?: string;
};

export type LinkSettings = {
  thumbnailUrl?: string;
  prioritize: boolean;
  schedule?: LinkSchedule;
  locked: boolean;
  lockMessage?: string;
};

export type ContentType = "link" | "discount" | "embed_post";

export type EmbedProvider = "x" | "facebook" | "tiktok" | "youtube" | "generic";
export type EmbedMode = "url" | "code";

export type DiscountCodeData = {
  type: "discount_code";
  cardTitle: string;
  cardThumbnail: string;
  layout: "classic" | "featured";
  modalTitle: string;
  modalHeroImage: string;
  modalDescription: string;
  discountCode: string;
  copyButtonLabel: string;
  ctaButtonLabel: string;
  destinationUrl: string;
  dismissible: boolean;
  codeLock?: {
    enabled: boolean;
    pin?: string;
  };
  analyticsHooks?: {
    trackModalOpen: boolean;
    trackCodeCopy: boolean;
    trackCtaClick: boolean;
  };
};

export type EmbedPostData = {
  type: "embed_post";
  provider: EmbedProvider;
  cardTitle: string;
  cardIcon: string;
  cardThumbnail: string;
  layout: "classic" | "featured";
  modalTitle: string;
  embedMode: EmbedMode;
  sourceUrl: string;
  embedCode: string;
  description: string;
  ctaButtonLabel: string;
  ctaUrl: string;
  dismissible: boolean;
};

export type BioLink = {
  id: string;
  contentType?: ContentType;
  title: string;
  url: string;
  enabled: boolean;
  description?: string;
  discount?: DiscountCodeData;
  embedPost?: EmbedPostData;
  settings: LinkSettings;
};

export type ProfileHeader = {
  username: string;
  displayName: string;
  tagline: string;
  avatarUrl: string;
  heroImageUrl?: string;
  layout?: "classic" | "hero";
  titleMode?: "display_name" | "username";
  heroTextAlign?: "left" | "center";
  heroOverlay?: boolean;
  heroOverlayStrength?: number;
  matchThemeToHero?: boolean;
};

export type ProfileText = {
  intro: string;
  body: string;
  footerEnabled?: boolean;
  footerText?: string;
};

export type ButtonStyle = {
  uppercase: boolean;
  shadow: boolean;
  style?: "solid" | "glass" | "outline";
  shadowLevel?: 0 | 1 | 2 | 3;
};

export type BuilderData = {
  header: ProfileHeader;
  theme: BuilderTheme;
  text: ProfileText;
  buttonStyle: ButtonStyle;
  socials: SocialLink[];
  links: BioLink[];
};
