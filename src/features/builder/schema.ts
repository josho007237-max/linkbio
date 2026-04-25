import { z } from "zod";

const isImageSourceValue = (value: string): boolean =>
  z.string().url().safeParse(value).success ||
  value.startsWith("data:image/") ||
  value.startsWith("idbimg:") ||
  value.startsWith("blob:") ||
  value.startsWith("/");

const imageSourceSchema = z
  .string()
  .trim()
  .refine(
    (value) => isImageSourceValue(value),
    "Image must be a valid URL, local placeholder path, or uploaded image.",
  );

const optionalImageSourceSchema = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isImageSourceValue(value), message);

const isUrlOrLocalPathValue = (value: string): boolean =>
  z.string().url().safeParse(value).success || value.startsWith("/");

const optionalUrlOrLocalPathSchema = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isUrlOrLocalPathValue(value), message);

const persistedStringSchema = z.string().trim().catch("");

const persistedUrlStringSchema = z.string().trim().catch("");

const persistedImageSourceSchema = z
  .string()
  .trim()
  .catch("")
  .transform((value) => (value && isImageSourceValue(value) ? value : ""));

const persistedOptionalImageSourceSchema = z
  .string()
  .trim()
  .optional()
  .catch(undefined)
  .transform((value) => (value && isImageSourceValue(value) ? value : undefined));

const preOpenModalSchema = z.object({
  enabled: z.boolean().optional(),
  bannerImageUrl: optionalImageSourceSchema(
    "Banner image must be a valid URL, local placeholder path, or uploaded image.",
  ),
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  primaryButtonLabel: z.string().trim().optional(),
  destinationUrl: z.string().trim().optional(),
  showSecondaryButton: z.boolean().optional(),
  secondaryButtonLabel: z.string().trim().optional(),
  dismissible: z.boolean().optional(),
  buttonStyle: z.enum(["solid", "outline", "glow"]).optional(),
});

const persistedPreOpenModalSchema = z.object({
  enabled: z.boolean().default(false),
  bannerImageUrl: persistedStringSchema.optional(),
  title: persistedStringSchema.default(""),
  description: persistedStringSchema.default(""),
  primaryButtonLabel: persistedStringSchema.default("Continue"),
  destinationUrl: persistedUrlStringSchema.optional(),
  showSecondaryButton: z.boolean().optional(),
  secondaryButtonLabel: persistedStringSchema.optional(),
  dismissible: z.boolean().optional(),
  buttonStyle: z.enum(["solid", "outline", "glow"]).optional(),
});

export const headerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .regex(/^[a-z0-9._-]+$/i, "Use letters, numbers, dots, dashes, or underscores."),
  publicHandle: z
    .string()
    .trim()
    .min(3, "Public handle must be at least 3 characters.")
    .regex(/^[a-z0-9._-]+$/i, "Use letters, numbers, dots, dashes, or underscores.")
    .optional(),
  // Backward-compat for older payloads.
  publicUsername: z
    .string()
    .trim()
    .min(3, "Public username must be at least 3 characters.")
    .regex(/^[a-z0-9._-]+$/i, "Use letters, numbers, dots, dashes, or underscores.")
    .optional(),
  displayName: z.string().trim().min(2, "Display name is required."),
  tagline: z.string().trim().min(2, "Tagline is required."),
  shareTitle: z.string().trim().optional(),
  shareDescription: z.string().trim().optional(),
  shareImageUrl: optionalImageSourceSchema(
    "Share image must be a valid URL, local placeholder path, or uploaded image.",
  ),
  avatarUrl: imageSourceSchema,
  heroImageUrl: imageSourceSchema.default("/placeholders/wallpaper-default.svg"),
  layout: z.enum(["classic", "hero"]),
  titleMode: z.enum(["display_name", "username"]),
  heroTextAlign: z.enum(["left", "center"]).default("center"),
  heroOverlay: z.boolean().default(true),
  heroOverlayStrength: z.number().min(0).max(0.9).default(0.35),
  matchThemeToHero: z.boolean().default(false),
});

export const wallpaperSchema = z.object({
  wallpaperUrl: imageSourceSchema,
  wallpaperVideoUrl: z.string().trim().optional(),
  wallpaperStyle: z.enum(["fill", "gradient", "blur", "pattern", "image", "video"]),
  pageBackground: z.string().trim().min(4),
  cardBackground: z.string().trim().min(4),
  textColor: z.string().trim().min(4),
  mutedTextColor: z.string().trim().min(4),
  titleColor: z.string().trim().min(4),
  titleSize: z.number().min(14).max(72),
  pageFont: z.enum(["inter", "poppins", "manrope", "space_grotesk"]),
});

export const textSchema = z.object({
  intro: z.string().trim(),
  body: z.string().trim(),
  footerEnabled: z.boolean(),
  footerText: z.string().trim(),
});

export const buttonSchema = z.object({
  buttonBackground: z.string().trim().min(4),
  buttonTextColor: z.string().trim().min(4),
  buttonRadius: z.number().min(0).max(999),
  uppercase: z.boolean(),
  shadow: z.boolean(),
  style: z.enum(["solid", "glass", "outline"]),
  shadowLevel: z.number().int().min(0).max(3),
});

export const socialSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube", "x", "facebook", "website"]),
  url: z.string().url("Social URL must be valid."),
  enabled: z.boolean(),
  iconImageUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || z.string().url().safeParse(value).success,
      "Social icon image URL must be a valid URL.",
    ),
  iconUrl: optionalImageSourceSchema(
    "Social icon must be a valid URL, local placeholder path, or uploaded image.",
  ),
  preOpenModal: preOpenModalSchema.optional(),
});

export const linkSchema = z
  .object({
    contentType: z.enum(["link", "discount", "embed_post", "form", "promo_gallery", "external_form"]),
    title: z.string().trim().optional(),
    url: z.string().trim().optional(),
    description: z.string().trim().optional(),
    enabled: z.boolean(),
    cardTitle: z.string().trim().optional(),
    cardThumbnail: optionalUrlOrLocalPathSchema(
      "Thumbnail must be a valid URL or local placeholder path.",
    ),
    layout: z.enum(["classic", "featured"]).optional(),
    modalTitle: z.string().trim().optional(),
    modalHeroImage: optionalUrlOrLocalPathSchema(
      "Hero image must be a valid URL or local placeholder path.",
    ),
    modalDescription: z.string().trim().optional(),
    discountCode: z.string().trim().optional(),
    copyButtonLabel: z.string().trim().optional(),
    ctaButtonLabel: z.string().trim().optional(),
    destinationUrl: z.string().trim().optional(),
    dismissible: z.boolean().optional(),
    embedProvider: z.enum(["x", "facebook", "tiktok", "youtube", "generic"]).optional(),
    embedCardTitle: z.string().trim().optional(),
    embedCardIcon: optionalUrlOrLocalPathSchema(
      "Card icon must be a valid URL or local placeholder path.",
    ),
    embedCardThumbnail: optionalUrlOrLocalPathSchema(
      "Card thumbnail must be a valid URL or local placeholder path.",
    ),
    embedLayout: z.enum(["classic", "featured"]).optional(),
    embedModalTitle: z.string().trim().optional(),
    embedMode: z.enum(["url", "code"]).optional(),
    embedSourceUrl: z.string().trim().optional(),
    embedCode: z.string().trim().optional(),
    embedDescription: z.string().trim().optional(),
    embedCtaButtonLabel: z.string().trim().optional(),
    embedCtaUrl: z.string().trim().optional(),
    embedDismissible: z.boolean().optional(),
    formTemplate: z
      .enum([
        "email_signup",
        "sms_signup",
        "contact_form",
        "custom",
        "deposit_issue",
        "withdraw_issue",
      ])
      .optional(),
    formLayout: z.enum(["classic", "featured"]).optional(),
    formTitle: z.string().trim().optional(),
    formIntro: z.string().trim().optional(),
    formOutro: z.string().trim().optional(),
    formSubmitLabel: z.string().trim().optional(),
    formCancelLabel: z.string().trim().optional(),
    formTermsPlaceholder: z.string().trim().optional(),
    promoTitle: z.string().trim().optional(),
    promoDescription: z.string().trim().optional(),
    promoItems: z
      .array(
        z.object({
          id: z.string().trim().optional(),
          imageUrl: optionalUrlOrLocalPathSchema(
            "Promo image URL must be a valid URL or local placeholder path.",
          ),
          title: z.string().trim().optional(),
          description: z.string().trim().optional(),
          badge: z.string().trim().optional(),
          conditions: z
            .array(
              z.object({
                id: z.string().trim().optional(),
                label: z.string().trim().optional(),
                value: z.string().trim().optional(),
              }),
            )
            .optional(),
          ctaLabel: z.string().trim().optional(),
          ctaUrl: optionalUrlOrLocalPathSchema(
            "Promo CTA URL must be a valid URL or local placeholder path.",
          ),
          openInNewTab: z.boolean().optional(),
          active: z.boolean().optional(),
        }),
      )
      .optional(),
    externalFormTitle: z.string().trim().optional(),
    externalFormDescription: z.string().trim().optional(),
    externalFormUrl: optionalUrlOrLocalPathSchema(
      "External form URL must be a valid URL or local placeholder path.",
    ),
    externalFormOpenMode: z.enum(["new_tab", "modal", "embed"]).optional(),
    externalFormEmbedHtml: z.string().trim().optional(),
    externalFormCtaLabel: z.string().trim().optional(),
    externalFormCloseLabel: z.string().trim().optional(),
    externalFormEnabled: z.boolean().optional(),
    externalFormShowOpenInBrowserButton: z.boolean().optional(),
    preOpenEnabled: z.boolean().optional(),
    preOpenBannerImageUrl: optionalUrlOrLocalPathSchema(
      "Banner image must be a valid URL or local placeholder path.",
    ),
    preOpenTitle: z.string().trim().optional(),
    preOpenDescription: z.string().trim().optional(),
    preOpenPrimaryButtonLabel: z.string().trim().optional(),
    preOpenDestinationUrl: z.string().trim().optional(),
    preOpenShowSecondaryButton: z.boolean().optional(),
    preOpenSecondaryButtonLabel: z.string().trim().optional(),
    preOpenDismissible: z.boolean().optional(),
    preOpenButtonStyle: z.enum(["solid", "outline", "glow"]).optional(),
    style: z
      .enum(["icon_left", "image_banner", "text_only", "media_card", "text_panel"])
      .optional(),
    displayStyle: z
      .enum(["icon_left", "image_banner", "text_only", "media_card", "text_panel"])
      .optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    bannerRatio: z.enum(["3:1", "2:1"]).optional(),
    imageAspect: z.enum(["3:1", "2:1"]).optional(),
    imageFit: z.enum(["cover", "contain"]).optional(),
    imageUrl: optionalUrlOrLocalPathSchema(
      "Image URL must be a valid URL or local placeholder path.",
    ),
    iconImageUrl: optionalUrlOrLocalPathSchema(
      "Icon image URL must be a valid URL or local placeholder path.",
    ),
    backgroundImageUrl: optionalUrlOrLocalPathSchema(
      "Background image URL must be a valid URL or local placeholder path.",
    ),
    preserveLineBreaks: z.boolean().optional(),
    textPanelContent: z.string().optional(),
    openInNewTab: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    titleSize: z.number().optional(),
    textColor: z.string().trim().optional(),
    backgroundColor: z.string().trim().optional(),
    borderColor: z.string().trim().optional(),
    showBorder: z.boolean().optional(),
    borderRadius: z.number().optional(),
    formFields: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1),
          type: z.enum([
            "name",
            "email",
            "phone",
            "country",
            "date_of_birth",
            "time_hms",
            "short_answer",
            "paragraph",
            "single_choice",
            "checkboxes",
            "dropdown",
            "date",
            "file_image",
          ]),
          required: z.boolean(),
          placeholder: z.string().trim().optional(),
          options: z.array(z.string().trim().min(1)).optional(),
        }),
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.contentType === "link") {
      return;
    }

    if (value.contentType === "discount" && !value.cardTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Card title is required.",
        path: ["cardTitle"],
      });
    }

    if (value.contentType === "discount" && !value.modalTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Modal title is required.",
        path: ["modalTitle"],
      });
    }

    if (value.contentType === "discount" && !value.layout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Layout is required.",
        path: ["layout"],
      });
    }

    if (value.contentType === "discount" && !value.discountCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount code is required",
        path: ["discountCode"],
      });
    }

    if (value.contentType === "discount" && !value.copyButtonLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Copy button label is required.",
        path: ["copyButtonLabel"],
      });
    }

    if (value.contentType === "discount" && !value.ctaButtonLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CTA button label is required.",
        path: ["ctaButtonLabel"],
      });
    }

    const destinationUrl = value.destinationUrl ?? "";
    if (
      value.contentType === "discount" &&
      (!destinationUrl || !z.string().url().safeParse(destinationUrl).success)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Destination URL is invalid",
        path: ["destinationUrl"],
      });
    }

    if (value.contentType === "form") {
      if (!value.formLayout) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Form layout is required.",
          path: ["formLayout"],
        });
      }
      if (!(value.formTitle ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Form title is required.",
          path: ["formTitle"],
        });
      }
      if (!(value.formSubmitLabel ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Submit label is required.",
          path: ["formSubmitLabel"],
        });
      }

      const fields = value.formFields ?? [];
      if (fields.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one form field is required.",
          path: ["formFields"],
        });
      }

      fields.forEach((field, index) => {
        if (!field.label.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Field label is required.",
            path: ["formFields", index, "label"],
          });
        }
        if (
          (field.type === "single_choice" ||
            field.type === "checkboxes" ||
            field.type === "dropdown") &&
          (!field.options || field.options.filter((option) => option.trim().length > 0).length === 0)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Choice fields must include options.",
            path: ["formFields", index, "options"],
          });
        }
      });

      return;
    }

    if (value.preOpenEnabled) {
      if (!(value.preOpenTitle ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pre-open modal title is required.",
          path: ["preOpenTitle"],
        });
      }
      if (!(value.preOpenPrimaryButtonLabel ?? "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pre-open modal primary button label is required.",
          path: ["preOpenPrimaryButtonLabel"],
        });
      }
      const destinationUrl = (value.preOpenDestinationUrl ?? "").trim();
      if (destinationUrl && !z.string().url().safeParse(destinationUrl).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pre-open destination URL is invalid.",
          path: ["preOpenDestinationUrl"],
        });
      }
    }

    if (value.contentType !== "embed_post") {
      return;
    }

    if (!value.embedProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provider is required.",
        path: ["embedProvider"],
      });
    }
    if (!value.embedCardTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Card title is required.",
        path: ["embedCardTitle"],
      });
    }
    if (!value.embedLayout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Layout is required.",
        path: ["embedLayout"],
      });
    }
    if (!value.embedModalTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Modal title is required.",
        path: ["embedModalTitle"],
      });
    }
    if (!value.embedMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Embed mode is required.",
        path: ["embedMode"],
      });
    }
    if (value.embedMode === "url") {
      const sourceUrl = value.embedSourceUrl ?? "";
      if (!sourceUrl || !z.string().url().safeParse(sourceUrl).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Source URL is invalid",
          path: ["embedSourceUrl"],
        });
      }
    }
    if (value.embedMode === "code" && !(value.embedCode ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Embed code is required",
        path: ["embedCode"],
      });
    }
    if (!value.embedCtaButtonLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CTA button label is required.",
        path: ["embedCtaButtonLabel"],
      });
    }
    const embedCtaUrl = value.embedCtaUrl ?? "";
    if (!embedCtaUrl || !z.string().url().safeParse(embedCtaUrl).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CTA URL is invalid",
        path: ["embedCtaUrl"],
      });
    }
  });

export const linkSettingsSchema = z.object({
  thumbnailUrl: optionalUrlOrLocalPathSchema(
    "Thumbnail must be a valid URL or local placeholder path.",
  ),
  prioritize: z.boolean(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  locked: z.boolean(),
  lockMessage: z.string().trim().optional(),
  style: z
    .enum(["icon_left", "image_banner", "text_only", "media_card", "text_panel"])
    .optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  bannerRatio: z.enum(["3:1", "2:1"]).optional(),
  imageFit: z.enum(["cover", "contain"]).optional(),
  imageUrl: optionalUrlOrLocalPathSchema("Image URL must be a valid URL or local placeholder path."),
  iconImageUrl: optionalUrlOrLocalPathSchema(
    "Icon image URL must be a valid URL or local placeholder path.",
  ),
  backgroundImageUrl: optionalUrlOrLocalPathSchema(
    "Background image URL must be a valid URL or local placeholder path.",
  ),
  preserveLineBreaks: z.boolean().optional(),
  textPanelContent: z.string().optional(),
  openInNewTab: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  titleSize: z.number().optional(),
  textColor: z.string().trim().optional(),
  backgroundColor: z.string().trim().optional(),
  borderColor: z.string().trim().optional(),
  showBorder: z.boolean().optional(),
  borderRadius: z.number().optional(),
});

export const builderDataSchema = z.object({
  header: z.object({
    username: persistedStringSchema.default("bn9"),
    publicHandle: persistedStringSchema.optional(),
    publicUsername: persistedStringSchema.optional(),
    displayName: persistedStringSchema.default("Brand"),
    tagline: persistedStringSchema.default("Tagline"),
    shareTitle: persistedStringSchema.default(""),
    shareDescription: persistedStringSchema.default(""),
    shareImageUrl: persistedImageSourceSchema.default(""),
    avatarUrl: persistedImageSourceSchema.default("/placeholders/avatar-default.svg"),
    heroImageUrl: persistedImageSourceSchema.default("/placeholders/wallpaper-default.svg"),
    layout: z.enum(["classic", "hero"]).default("classic"),
    titleMode: z.enum(["display_name", "username"]).default("display_name"),
    heroTextAlign: z.enum(["left", "center"]).default("center"),
    heroOverlay: z.boolean().default(true),
    heroOverlayStrength: z.number().min(0).max(0.9).default(0.35),
    matchThemeToHero: z.boolean().default(false),
  }),
  theme: z.object({
    name: z.enum(["midnight", "sunset", "forest"]).default("midnight"),
    wallpaperUrl: persistedImageSourceSchema.default("/placeholders/wallpaper-default.svg"),
    wallpaperVideoUrl: persistedStringSchema.optional(),
    wallpaperStyle: z
      .enum(["fill", "gradient", "blur", "pattern", "image", "video"])
      .default("image"),
    pageBackground: persistedStringSchema.default("#0f172a"),
    cardBackground: persistedStringSchema.default("rgba(15,23,42,0.72)"),
    textColor: persistedStringSchema.default("#ffffff"),
    mutedTextColor: persistedStringSchema.default("#cbd5e1"),
    titleColor: persistedStringSchema.optional(),
    titleSize: z.number().min(14).max(72).optional(),
    pageFont: z.enum(["inter", "poppins", "manrope", "space_grotesk"]).optional(),
    buttonBackground: persistedStringSchema.default("#ffffff"),
    buttonTextColor: persistedStringSchema.default("#0f172a"),
    buttonRadius: z.number().min(0).max(999).default(20),
  }),
  text: z.object({
    intro: persistedStringSchema.default(""),
    body: persistedStringSchema.default(""),
    footerEnabled: z.boolean().default(false),
    footerText: persistedStringSchema.default(""),
  }),
  buttonStyle: z.object({
    uppercase: z.boolean().default(false),
    shadow: z.boolean().default(true),
    style: z.enum(["solid", "glass", "outline"]).default("solid"),
    shadowLevel: z.number().min(0).max(3).default(2),
  }),
  socials: z.array(
    z.object({
      id: z.string().min(1),
      platform: socialSchema.shape.platform,
      url: persistedUrlStringSchema.default(""),
      enabled: z.boolean(),
      iconImageUrl: persistedUrlStringSchema.optional(),
      iconUrl: persistedOptionalImageSourceSchema,
      preOpenModal: persistedPreOpenModalSchema.optional(),
    }),
  ).default([]),
  links: z.array(
    z.object({
      id: z.string().min(1),
      contentType: z.enum(["link", "discount", "embed_post", "form", "promo_gallery", "external_form"]).default("link"),
      title: persistedStringSchema.default("Untitled"),
      url: persistedUrlStringSchema.default(""),
      description: persistedStringSchema.optional(),
      enabled: z.boolean().default(true),
      discount: z
        .object({
          type: z.literal("discount_code").optional(),
          cardTitle: persistedStringSchema.optional(),
          cardThumbnail: persistedStringSchema.optional(),
          layout: z.enum(["classic", "featured"]).default("classic"),
          modalTitle: persistedStringSchema.optional(),
          modalHeroImage: persistedStringSchema.optional(),
          modalDescription: persistedStringSchema.optional(),
          discountCode: persistedStringSchema.optional(),
          copyButtonLabel: persistedStringSchema.optional(),
          ctaButtonLabel: persistedStringSchema.optional(),
          destinationUrl: persistedUrlStringSchema.optional(),
          dismissible: z.boolean().optional(),
          code: persistedStringSchema.optional(),
          buttonLabel: persistedStringSchema.optional(),
          codeLock: z
            .object({
              enabled: z.boolean().optional(),
              pin: persistedStringSchema.optional(),
            })
            .optional(),
          analyticsHooks: z
            .object({
              trackModalOpen: z.boolean().optional(),
              trackCodeCopy: z.boolean().optional(),
              trackCtaClick: z.boolean().optional(),
            })
            .optional(),
        })
        .optional(),
      embedPost: z
        .object({
          type: z.literal("embed_post").optional(),
          provider: z.enum(["x", "facebook", "tiktok", "youtube", "generic"]).optional(),
          cardTitle: persistedStringSchema.optional(),
          cardIcon: persistedStringSchema.optional(),
          cardThumbnail: persistedStringSchema.optional(),
          layout: z.enum(["classic", "featured"]).optional(),
          modalTitle: persistedStringSchema.optional(),
          embedMode: z.enum(["url", "code"]).optional(),
          sourceUrl: persistedUrlStringSchema.optional(),
          embedCode: persistedStringSchema.optional(),
          description: persistedStringSchema.optional(),
          ctaButtonLabel: persistedStringSchema.optional(),
          ctaUrl: persistedUrlStringSchema.optional(),
          dismissible: z.boolean().optional(),
        })
        .optional(),
      form: z
        .object({
          type: z.literal("form").optional(),
          template: z
            .enum([
              "email_signup",
              "sms_signup",
              "contact_form",
              "custom",
              "deposit_issue",
              "withdraw_issue",
            ])
            .optional(),
          layout: z.enum(["classic", "featured"]).optional(),
          formTitle: z.string().optional(),
          intro: z.string().optional(),
          outro: z.string().optional(),
          submitLabel: z.string().optional(),
          cancelLabel: z.string().optional(),
          termsPlaceholder: z.string().optional(),
          fields: z
            .array(
              z.object({
                id: z.string().optional(),
                label: z.string().optional(),
                type: z
                  .enum([
                    "name",
                    "email",
                    "phone",
                    "country",
                    "date_of_birth",
                    "time_hms",
                    "short_answer",
                    "paragraph",
                    "single_choice",
                    "checkboxes",
                    "dropdown",
                    "date",
                    "file_image",
                  ])
                  .optional(),
                required: z.boolean().optional(),
                placeholder: z.string().optional(),
                options: z.array(z.string()).optional(),
              }),
            )
            .optional(),
        })
        .optional(),
      promoGallery: z
        .object({
          type: z.literal("promo_gallery").optional(),
          title: persistedStringSchema.optional(),
          description: persistedStringSchema.optional(),
          items: z
            .array(
              z.object({
                id: z.string().optional(),
                imageUrl: persistedStringSchema.optional(),
                title: persistedStringSchema.optional(),
                description: persistedStringSchema.optional(),
                badge: persistedStringSchema.optional(),
                conditions: z
                  .array(
                    z.object({
                      id: z.string().optional(),
                      label: persistedStringSchema.optional(),
                      value: persistedStringSchema.optional(),
                    }),
                  )
                  .optional(),
                ctaLabel: persistedStringSchema.optional(),
                ctaUrl: persistedStringSchema.optional(),
                openInNewTab: z.boolean().optional(),
                active: z.boolean().optional(),
              }),
            )
            .optional(),
        })
        .optional(),
      externalForm: z
        .object({
          type: z.literal("external_form").optional(),
          title: persistedStringSchema.optional(),
          description: persistedStringSchema.optional(),
          formUrl: persistedUrlStringSchema.optional(),
          openMode: z.enum(["new_tab", "modal", "embed"]).optional(),
          embedHtml: persistedStringSchema.optional(),
          ctaLabel: persistedStringSchema.optional(),
          closeLabel: persistedStringSchema.optional(),
          enabled: z.boolean().optional(),
          showOpenInBrowserButton: z.boolean().optional(),
        })
        .optional(),
      preOpenModal: persistedPreOpenModalSchema.optional(),
      settings: z.object({
        thumbnailUrl: persistedOptionalImageSourceSchema,
        prioritize: z.boolean().default(false),
        schedule: z
          .object({
            startAt: persistedStringSchema.optional(),
            endAt: persistedStringSchema.optional(),
          })
          .optional(),
        locked: z.boolean().default(false),
        lockMessage: persistedStringSchema.optional(),
        style: z
          .enum(["icon_left", "image_banner", "text_only", "media_card", "text_panel"])
          .default("icon_left"),
        displayStyle: z
          .enum(["icon_left", "image_banner", "text_only", "media_card", "text_panel"])
          .optional(),
        textAlign: z.enum(["left", "center", "right"]).default("left"),
        bannerRatio: z.enum(["3:1", "2:1"]).default("3:1"),
        imageAspect: z.enum(["3:1", "2:1"]).optional(),
        imageFit: z.enum(["cover", "contain"]).default("cover"),
        imageUrl: persistedStringSchema.optional(),
        iconImageUrl: persistedStringSchema.optional(),
        backgroundImageUrl: persistedStringSchema.optional(),
        preserveLineBreaks: z.boolean().default(true),
        textPanelContent: persistedStringSchema.optional(),
        openInNewTab: z.boolean().default(true),
        sortOrder: z.number().int().optional(),
        titleSize: z.number().optional(),
        textColor: persistedStringSchema.optional(),
        backgroundColor: persistedStringSchema.optional(),
        borderColor: persistedStringSchema.optional(),
        showBorder: z.boolean().default(true),
        borderRadius: z.number().optional(),
      }),
    }),
  ).default([]),
});

export type HeaderFormValues = z.infer<typeof headerSchema>;
export type WallpaperFormValues = z.infer<typeof wallpaperSchema>;
export type TextFormValues = z.infer<typeof textSchema>;
export type ButtonFormValues = z.infer<typeof buttonSchema>;
export type SocialFormValues = z.infer<typeof socialSchema>;
export type LinkFormValues = z.infer<typeof linkSchema>;
export type LinkSettingsFormValues = z.infer<typeof linkSettingsSchema>;
export type BuilderDataFormValues = z.infer<typeof builderDataSchema>;

