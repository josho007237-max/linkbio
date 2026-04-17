import { z } from "zod";

const imageSourceSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      z.string().url().safeParse(value).success ||
      value.startsWith("data:image/") ||
      value.startsWith("/"),
    "Image must be a valid URL, local placeholder path, or uploaded image.",
  );

export const headerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .regex(/^[a-z0-9._-]+$/i, "Use letters, numbers, dots, dashes, or underscores."),
  displayName: z.string().trim().min(2, "Display name is required."),
  tagline: z.string().trim().min(2, "Tagline is required."),
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
  intro: z.string().trim().min(2, "Intro text is required."),
  body: z.string().trim().min(2, "Body text is required."),
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
  iconUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value ||
        z.string().url().safeParse(value).success ||
        value.startsWith("data:image/") ||
        value.startsWith("/"),
      "Social icon must be a valid URL, local placeholder path, or uploaded image.",
    ),
});

export const linkSchema = z
  .object({
    contentType: z.enum(["link", "discount", "embed_post", "form"]),
    title: z.string().trim().min(1, "Title is required."),
    url: z.string().url("Link URL must be valid."),
    description: z.string().trim().optional(),
    enabled: z.boolean(),
    cardTitle: z.string().trim().optional(),
    cardThumbnail: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          !value ||
          z.string().url().safeParse(value).success ||
          value.startsWith("data:image/") ||
          value.startsWith("/"),
        "Thumbnail must be a valid URL, local placeholder path, or uploaded image.",
      ),
    layout: z.enum(["classic", "featured"]).optional(),
    modalTitle: z.string().trim().optional(),
    modalHeroImage: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          !value ||
          z.string().url().safeParse(value).success ||
          value.startsWith("data:image/") ||
          value.startsWith("/"),
        "Hero image must be a valid URL, local placeholder path, or uploaded image.",
      ),
    modalDescription: z.string().trim().optional(),
    discountCode: z.string().trim().optional(),
    copyButtonLabel: z.string().trim().optional(),
    ctaButtonLabel: z.string().trim().optional(),
    destinationUrl: z.string().trim().optional(),
    dismissible: z.boolean().optional(),
    embedProvider: z.enum(["x", "facebook", "tiktok", "youtube", "generic"]).optional(),
    embedCardTitle: z.string().trim().optional(),
    embedCardIcon: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          !value ||
          z.string().url().safeParse(value).success ||
          value.startsWith("data:image/") ||
          value.startsWith("/"),
        "Card icon must be a valid URL, local placeholder path, or uploaded image.",
      ),
    embedCardThumbnail: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          !value ||
          z.string().url().safeParse(value).success ||
          value.startsWith("data:image/") ||
          value.startsWith("/"),
        "Card thumbnail must be a valid URL, local placeholder path, or uploaded image.",
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
    formTermsPlaceholder: z.string().trim().optional(),
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
  thumbnailUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value ||
        z.string().url().safeParse(value).success ||
        value.startsWith("data:image/") ||
        value.startsWith("/"),
      "Thumbnail must be a valid URL, local placeholder path, or uploaded image.",
    ),
  prioritize: z.boolean(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  locked: z.boolean(),
  lockMessage: z.string().trim().optional(),
});

export const builderDataSchema = z.object({
  header: headerSchema,
  theme: z.object({
    name: z.enum(["midnight", "sunset", "forest"]),
    wallpaperUrl: imageSourceSchema,
    wallpaperVideoUrl: z.string().optional(),
    wallpaperStyle: z
      .enum(["fill", "gradient", "blur", "pattern", "image", "video"])
      .optional(),
    pageBackground: z.string().trim().min(4),
    cardBackground: z.string().trim().min(4),
    textColor: z.string().trim().min(4),
    mutedTextColor: z.string().trim().min(4),
    titleColor: z.string().trim().min(4).optional(),
    titleSize: z.number().min(14).max(72).optional(),
    pageFont: z.enum(["inter", "poppins", "manrope", "space_grotesk"]).optional(),
    buttonBackground: z.string().trim().min(4),
    buttonTextColor: z.string().trim().min(4),
    buttonRadius: z.number().min(0).max(999),
  }),
  text: textSchema,
  buttonStyle: z.object({
    uppercase: z.boolean(),
    shadow: z.boolean(),
    style: z.enum(["solid", "glass", "outline"]).optional(),
    shadowLevel: z.number().min(0).max(3).optional(),
  }),
  socials: z.array(
    z.object({
      id: z.string().min(1),
      platform: socialSchema.shape.platform,
      url: socialSchema.shape.url,
      enabled: z.boolean(),
      iconUrl: socialSchema.shape.iconUrl,
    }),
  ),
  links: z.array(
    z.object({
      id: z.string().min(1),
      contentType: z.enum(["link", "discount", "embed_post", "form"]).default("link"),
      title: linkSchema.shape.title,
      url: linkSchema.shape.url,
      description: z.string().optional(),
      enabled: z.boolean(),
      discount: z
        .object({
          type: z.literal("discount_code").optional(),
          cardTitle: z.string().min(1).optional(),
          cardThumbnail: z.string().optional(),
          layout: z.enum(["classic", "featured"]).default("classic"),
          modalTitle: z.string().min(1).optional(),
          modalHeroImage: z.string().optional(),
          modalDescription: z.string().optional(),
          discountCode: z.string().optional(),
          copyButtonLabel: z.string().optional(),
          ctaButtonLabel: z.string().optional(),
          destinationUrl: z.string().optional(),
          dismissible: z.boolean().optional(),
          code: z.string().optional(),
          buttonLabel: z.string().optional(),
          codeLock: z
            .object({
              enabled: z.boolean().optional(),
              pin: z.string().optional(),
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
          cardTitle: z.string().optional(),
          cardIcon: z.string().optional(),
          cardThumbnail: z.string().optional(),
          layout: z.enum(["classic", "featured"]).optional(),
          modalTitle: z.string().optional(),
          embedMode: z.enum(["url", "code"]).optional(),
          sourceUrl: z.string().optional(),
          embedCode: z.string().optional(),
          description: z.string().optional(),
          ctaButtonLabel: z.string().optional(),
          ctaUrl: z.string().optional(),
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
      settings: z.object({
        thumbnailUrl: z
          .string()
          .optional()
          .refine(
            (value) =>
              !value ||
              z.string().url().safeParse(value).success ||
              value.startsWith("data:image/") ||
              value.startsWith("/"),
            "Thumbnail must be a valid URL, local placeholder path, or uploaded image.",
          ),
        prioritize: z.boolean(),
        schedule: z
          .object({
            startAt: z.string().optional(),
            endAt: z.string().optional(),
          })
          .optional(),
        locked: z.boolean(),
        lockMessage: z.string().optional(),
      }),
    }),
  ),
});

export type HeaderFormValues = z.infer<typeof headerSchema>;
export type WallpaperFormValues = z.infer<typeof wallpaperSchema>;
export type TextFormValues = z.infer<typeof textSchema>;
export type ButtonFormValues = z.infer<typeof buttonSchema>;
export type SocialFormValues = z.infer<typeof socialSchema>;
export type LinkFormValues = z.infer<typeof linkSchema>;
export type LinkSettingsFormValues = z.infer<typeof linkSettingsSchema>;
export type BuilderDataFormValues = z.infer<typeof builderDataSchema>;
