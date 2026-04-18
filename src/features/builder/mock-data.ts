import { BuilderData } from "@/features/builder/types";
import { defaultBrandPreset } from "@/features/builder/default-brand-preset";

export const mockBuilderData: BuilderData = {
  header: {
    username: defaultBrandPreset.username,
    publicUsername: defaultBrandPreset.username,
    displayName: defaultBrandPreset.brandName,
    tagline: defaultBrandPreset.tagline,
    avatarUrl: defaultBrandPreset.avatarUrl,
    heroImageUrl: defaultBrandPreset.heroImageUrl,
    layout: "classic",
    titleMode: "display_name",
    heroTextAlign: "center",
    heroOverlay: true,
    heroOverlayStrength: 0.35,
    matchThemeToHero: false,
  },
  theme: defaultBrandPreset.theme,
  text: {
    intro: defaultBrandPreset.intro,
    body: defaultBrandPreset.body,
    footerEnabled: false,
    footerText: "Powered by Link-in-Bio Builder",
  },
  buttonStyle: {
    uppercase: false,
    shadow: true,
    style: "solid",
    shadowLevel: 2,
  },
  socials: [
    {
      id: "social-instagram",
      platform: "instagram",
      url: defaultBrandPreset.socialUrls.instagram,
      enabled: true,
    },
    {
      id: "social-youtube",
      platform: "youtube",
      url: defaultBrandPreset.socialUrls.youtube,
      enabled: true,
    },
    {
      id: "social-x",
      platform: "x",
      url: defaultBrandPreset.socialUrls.x,
      enabled: true,
    },
  ],
  links: [
    {
      id: "link-01",
      contentType: "link",
      title: defaultBrandPreset.buttonLabels.primary,
      url: "https://example.com/primary",
      description: "Route visitors to your highest-priority business action.",
      enabled: true,
      settings: {
        prioritize: true,
        thumbnailUrl: "/placeholders/link-thumbnail-default.svg",
        locked: false,
      },
    },
    {
      id: "link-02",
      contentType: "link",
      title: defaultBrandPreset.buttonLabels.secondary,
      url: "https://example.com/secondary",
      description: "Share your core services, offers, or packages.",
      enabled: true,
      settings: {
        prioritize: false,
        locked: false,
      },
    },
    {
      id: "link-03",
      contentType: "discount",
      title: "โปรสมาชิกใหม่",
      url: "https://bn9.one",
      description: "คัดลอกโค้ดแล้วกดไปใช้งานต่อได้เลย",
      enabled: true,
      discount: {
        type: "discount_code",
        cardTitle: "โปรสมาชิกใหม่",
        cardThumbnail: "/placeholders/link-thumbnail-default.svg",
        layout: "featured",
        modalTitle: "รับสิทธิ์โปรสมาชิกใหม่",
        modalHeroImage: "/placeholders/link-thumbnail-default.svg",
        modalDescription: "คัดลอกโค้ดแล้วกดไปใช้งานต่อได้เลย",
        discountCode: "BN9NEW",
        copyButtonLabel: "คัดลอกโค้ด",
        ctaButtonLabel: "ไปที่เว็บ",
        destinationUrl: "https://bn9.one",
        dismissible: true,
        codeLock: {
          enabled: false,
        },
        analyticsHooks: {
          trackModalOpen: true,
          trackCodeCopy: true,
          trackCtaClick: true,
        },
      },
      settings: {
        prioritize: false,
        locked: true,
        lockMessage: "Private access",
        schedule: {
          startAt: "2026-04-01T00:00",
        },
      },
    },
  ],
};
