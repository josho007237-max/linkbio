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
  iconImageUrl?: string;
  iconUrl?: string;
  preOpenModal?: PreOpenModalConfig;
};

export type PreOpenButtonStyle = "solid" | "outline" | "glow";

export type PreOpenModalConfig = {
  enabled: boolean;
  bannerImageUrl?: string;
  title: string;
  description: string;
  primaryButtonLabel: string;
  destinationUrl?: string;
  showSecondaryButton?: boolean;
  secondaryButtonLabel?: string;
  dismissible?: boolean;
  buttonStyle?: PreOpenButtonStyle;
};

export type LinkSchedule = {
  startAt?: string;
  endAt?: string;
};

export type LinkDisplayStyle =
  | "icon_left"
  | "image_banner"
  | "text_only"
  | "media_card"
  | "text_panel";

export type LinkTextAlign = "left" | "center" | "right";
export type LinkBannerRatio = "3:1" | "2:1";
export type LinkImageFit = "cover" | "contain";

export type UnifiedMenuItemDisplay = {
  id: string;
  style?: LinkDisplayStyle;
  enabled?: boolean;
  sortOrder?: number;
  title?: string;
  description?: string;
  linkUrl?: string;
  openInNewTab?: boolean;
  textAlign?: LinkTextAlign;
  imageUrl?: string;
  iconImageUrl?: string;
  backgroundImageUrl?: string;
  imageBrightness?: number;
  imageContrast?: number;
  imageSaturation?: number;
  overlayOpacity?: number;
  preserveLineBreaks?: boolean;
  bannerRatio?: LinkBannerRatio;
  imageFit?: LinkImageFit;
  titleSize?: number;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  showBorder?: boolean;
  borderRadius?: number;
};

export type LinkSettings = {
  thumbnailUrl?: string;
  prioritize: boolean;
  schedule?: LinkSchedule;
  locked: boolean;
  lockMessage?: string;
  style?: LinkDisplayStyle;
  displayStyle?: LinkDisplayStyle;
  textAlign?: LinkTextAlign;
  bannerRatio?: LinkBannerRatio;
  imageFit?: LinkImageFit;
  imageUrl?: string;
  iconImageUrl?: string;
  backgroundImageUrl?: string;
  imageBrightness?: number;
  imageContrast?: number;
  imageSaturation?: number;
  overlayOpacity?: number;
  preserveLineBreaks?: boolean;
  textPanelContent?: string;
  openInNewTab?: boolean;
  sortOrder?: number;
  titleSize?: number;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  showBorder?: boolean;
  borderRadius?: number;
};

export type ExternalFormOpenMode = "new_tab" | "modal" | "embed";
export type ContentType =
  | "link"
  | "discount"
  | "embed_post"
  | "form"
  | "promo_gallery"
  | "external_form";

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
  checklistTitle: string;
  checklistItem1Label: string;
  checklistItem2Label: string;
  checklistItem3Label: string;
  sourceButtonLabel: string;
  sourceButtonUrl: string;
  sourceButtonOpenInNewTab: boolean;
  sourceButtonEnabled: boolean;
  ctaButtonLabel: string;
  ctaUrl: string;
  ctaButtonOpenInNewTab: boolean;
  ctaButtonEnabled: boolean;
  closeButtonLabel: string;
  closeButtonEnabled: boolean;
  showModalTitle: boolean;
  showDescription: boolean;
  showChecklist: boolean;
  showChecklistItem1: boolean;
  showChecklistItem2: boolean;
  showChecklistItem3: boolean;
  showSourceButton: boolean;
  showCtaButton: boolean;
  showCloseButton: boolean;
  showTopRightDismissButton: boolean;
  dismissible: boolean;
};

export type FormFieldType =
  | "name"
  | "email"
  | "phone"
  | "text"
  | "textarea"
  | "single_select"
  | "multi_select"
  | "time"
  | "image_upload"
  | "country"
  | "date_of_birth"
  | "time_hms"
  | "short_answer"
  | "paragraph"
  | "single_choice"
  | "checkboxes"
  | "dropdown"
  | "date"
  | "file_image";

export type FormTemplate =
  | "email_signup"
  | "sms_signup"
  | "contact_form"
  | "custom"
  | "deposit_issue"
  | "withdraw_issue";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

export type FormBlock = {
  type: "form";
  template: FormTemplate;
  layout: "classic" | "featured";
  formTitle: string;
  intro: string;
  outro: string;
  submitLabel: string;
  cancelLabel?: string;
  termsPlaceholder?: string;
  fields: FormField[];
};

export type PromoConditionRow = {
  id: string;
  label?: string;
  value?: string;
};

export type PromoGalleryItem = {
  id: string;
  imageUrl?: string;
  title?: string;
  description?: string;
  badge?: string;
  conditions?: PromoConditionRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  openInNewTab?: boolean;
  active?: boolean;
};

export type PromoGalleryBlock = {
  type: "promo_gallery";
  title?: string;
  description?: string;
  items: PromoGalleryItem[];
};

export type ExternalFormBlock = {
  type: "external_form";
  title?: string;
  description?: string;
  formUrl?: string;
  openMode?: ExternalFormOpenMode;
  embedHtml?: string;
  ctaLabel?: string;
  closeLabel?: string;
  enabled?: boolean;
  showOpenInBrowserButton?: boolean;
};

export type BioLink = {
  id: string;
  contentType?: ContentType;
  title: string;
  url: string;
  enabled: boolean;
  description?: string;
  preOpenModal?: PreOpenModalConfig;
  discount?: DiscountCodeData;
  embedPost?: EmbedPostData;
  form?: FormBlock;
  promoGallery?: PromoGalleryBlock;
  externalForm?: ExternalFormBlock;
  settings: LinkSettings;
};

export type ProfileHeader = {
  username: string;
  publicHandle?: string;
  // Backward-compat fallback for older saved payloads.
  publicUsername?: string;
  displayName: string;
  tagline: string;
  shareTitle?: string;
  shareDescription?: string;
  shareImageUrl?: string;
  avatarUrl: string;
  heroImageUrl?: string;
  layout?: "classic" | "hero" | "none";
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
