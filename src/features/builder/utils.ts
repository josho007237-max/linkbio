import {
  BuilderData,
  BioLink,
  ContentType,
  DiscountCodeData,
  EmbedPostData,
  FormBlock,
  FormField,
  FormTemplate,
} from "@/features/builder/types";

export const createId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const createEmptyLink = (): BioLink => ({
  id: createId("link"),
  contentType: "link",
  title: "New Link",
  url: "https://",
  description: "",
  enabled: true,
  settings: {
    prioritize: false,
    locked: false,
  },
});

export const createEmptyDiscountCode = (): BioLink => ({
  id: createId("discount"),
  contentType: "discount",
  title: "Limited Offer",
  url: "https://example.com/offer",
  description: "Tap to view full offer details and copy the code.",
  enabled: true,
  discount: {
    type: "discount_code",
    cardTitle: "โปรสมาชิกใหม่",
    cardThumbnail: "/placeholders/link-thumbnail-default.svg",
    layout: "classic",
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
    locked: false,
  },
});

export const createEmptyEmbedPost = (): BioLink => ({
  id: createId("embed"),
  contentType: "embed_post",
  title: "Social Embed",
  url: "https://example.com",
  description: "Tap to open embedded content.",
  enabled: true,
  embedPost: {
    type: "embed_post",
    provider: "youtube",
    cardTitle: "Featured Post",
    cardIcon: "",
    cardThumbnail: "/placeholders/link-thumbnail-default.svg",
    layout: "classic",
    modalTitle: "Watch this post",
    embedMode: "url",
    sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    embedCode: "",
    description: "Open this embedded post and continue to the full source.",
    ctaButtonLabel: "Open source",
    ctaUrl: "https://example.com",
    dismissible: true,
  },
  settings: {
    prioritize: false,
    locked: false,
  },
});

const FORM_TEMPLATE_FIELDS: Record<FormTemplate, FormField[]> = {
  email_signup: [
    { id: createId("form-field"), label: "Email", type: "email", required: true, placeholder: "you@example.com" },
  ],
  sms_signup: [
    { id: createId("form-field"), label: "Phone", type: "phone", required: true, placeholder: "+66 8X XXX XXXX" },
  ],
  contact_form: [
    { id: createId("form-field"), label: "Name", type: "name", required: true, placeholder: "Your name" },
    { id: createId("form-field"), label: "Email", type: "email", required: true, placeholder: "you@example.com" },
    { id: createId("form-field"), label: "Message", type: "paragraph", required: true, placeholder: "How can we help?" },
  ],
  custom: [
    { id: createId("form-field"), label: "Short answer", type: "short_answer", required: false, placeholder: "Type your answer" },
  ],
};

export const getFormTemplateFields = (template: FormTemplate): FormField[] =>
  (FORM_TEMPLATE_FIELDS[template] ?? FORM_TEMPLATE_FIELDS.custom).map((field) => ({
    ...field,
    id: createId("form-field"),
    options: field.options ? [...field.options] : undefined,
  }));

export const createEmptyFormBlock = (template: FormTemplate = "email_signup"): BioLink => ({
  id: createId("form"),
  contentType: "form",
  title: "New Form",
  url: "https://example.com/form",
  description: "Tap to open form.",
  enabled: true,
  form: {
    type: "form",
    template,
    layout: "classic",
    formTitle: "Join our list",
    intro: "Fill in the form below.",
    outro: "Thank you. We received your submission.",
    submitLabel: "Submit",
    termsPlaceholder: "",
    fields: getFormTemplateFields(template),
  },
  settings: {
    prioritize: false,
    locked: false,
  },
});

export const getContentType = (item: BioLink): ContentType =>
  item.contentType === "discount"
    ? "discount"
    : item.contentType === "embed_post"
      ? "embed_post"
      : item.contentType === "form"
        ? "form"
      : "link";

export const getDiscountData = (link: BioLink): DiscountCodeData => {
  const legacyCode =
    typeof (link.discount as { code?: string } | undefined)?.code === "string"
      ? (link.discount as { code?: string }).code ?? ""
      : "";
  const legacyButtonLabel =
    typeof (link.discount as { buttonLabel?: string } | undefined)?.buttonLabel === "string"
      ? (link.discount as { buttonLabel?: string }).buttonLabel ?? ""
      : "";

  return {
    type: "discount_code",
    cardTitle: link.discount?.cardTitle ?? link.title,
    cardThumbnail: link.discount?.cardThumbnail ?? "/placeholders/link-thumbnail-default.svg",
    layout: link.discount?.layout ?? "classic",
    modalTitle: link.discount?.modalTitle ?? "Claim your new member offer",
    modalHeroImage: link.discount?.modalHeroImage ?? "/placeholders/link-thumbnail-default.svg",
    modalDescription: link.discount?.modalDescription ?? link.description ?? "",
    discountCode: link.discount?.discountCode ?? legacyCode,
    copyButtonLabel: link.discount?.copyButtonLabel ?? "Copy code",
    ctaButtonLabel: link.discount?.ctaButtonLabel ?? (legacyButtonLabel || "Open link"),
    destinationUrl: link.discount?.destinationUrl ?? link.url,
    dismissible: link.discount?.dismissible ?? true,
    codeLock: {
      enabled: link.discount?.codeLock?.enabled ?? false,
      pin: link.discount?.codeLock?.pin,
    },
    analyticsHooks: {
      trackModalOpen: link.discount?.analyticsHooks?.trackModalOpen ?? true,
      trackCodeCopy: link.discount?.analyticsHooks?.trackCodeCopy ?? true,
      trackCtaClick: link.discount?.analyticsHooks?.trackCtaClick ?? true,
    },
  };
};

export const getEmbedPostData = (link: BioLink): EmbedPostData => ({
  type: "embed_post",
  provider: link.embedPost?.provider ?? "generic",
  cardTitle: link.embedPost?.cardTitle ?? link.title,
  cardIcon: link.embedPost?.cardIcon ?? "",
  cardThumbnail: link.embedPost?.cardThumbnail ?? "/placeholders/link-thumbnail-default.svg",
  layout: link.embedPost?.layout ?? "classic",
  modalTitle: link.embedPost?.modalTitle ?? link.title,
  embedMode: link.embedPost?.embedMode ?? "url",
  sourceUrl: link.embedPost?.sourceUrl ?? link.url,
  embedCode: link.embedPost?.embedCode ?? "",
  description: link.embedPost?.description ?? link.description ?? "",
  ctaButtonLabel: link.embedPost?.ctaButtonLabel ?? "Open source",
  ctaUrl: link.embedPost?.ctaUrl ?? link.url,
  dismissible: link.embedPost?.dismissible ?? true,
});

export const getFormData = (link: BioLink): FormBlock => ({
  type: "form",
  template: link.form?.template ?? "custom",
  layout: link.form?.layout ?? "classic",
  formTitle: link.form?.formTitle ?? link.title,
  intro: link.form?.intro ?? link.description ?? "",
  outro: link.form?.outro ?? "Thank you. We received your submission.",
  submitLabel: link.form?.submitLabel ?? "Submit",
  termsPlaceholder: link.form?.termsPlaceholder ?? "",
  fields:
    link.form?.fields && link.form.fields.length > 0
      ? link.form.fields.map((field) => ({
          ...field,
          options: field.options ? [...field.options] : undefined,
        }))
      : getFormTemplateFields(link.form?.template ?? "custom"),
});

export const isLinkActiveNow = (link: BioLink): boolean => {
  if (!link.enabled) {
    return false;
  }

  if (getContentType(link) === "discount" && !getDiscountData(link).discountCode.trim()) {
    return false;
  }
  if (getContentType(link) === "embed_post") {
    const embed = getEmbedPostData(link);
    if (embed.embedMode === "url" && !embed.sourceUrl.trim()) {
      return false;
    }
    if (embed.embedMode === "code" && !embed.embedCode.trim()) {
      return false;
    }
  }
  if (getContentType(link) === "form") {
    const form = getFormData(link);
    if (!form.fields.length) {
      return false;
    }
  }

  const schedule = link.settings.schedule;
  if (!schedule) {
    return true;
  }

  const now = new Date().getTime();
  const start = schedule.startAt ? new Date(schedule.startAt).getTime() : undefined;
  const end = schedule.endAt ? new Date(schedule.endAt).getTime() : undefined;

  if (typeof start === "number" && !Number.isNaN(start) && now < start) {
    return false;
  }

  if (typeof end === "number" && !Number.isNaN(end) && now > end) {
    return false;
  }

  return true;
};

export const getSortedVisibleLinks = (data: BuilderData): BioLink[] =>
  data.links
    .filter(isLinkActiveNow)
    .sort((a, b) => Number(b.settings.prioritize) - Number(a.settings.prioritize));

export const normalizeBuilderData = (data: BuilderData): BuilderData => ({
  ...data,
  links: data.links.map((link) => {
    if (getContentType(link) !== "discount") {
      return link;
    }

    const discount = getDiscountData(link);
    return {
      ...link,
      title: discount.cardTitle,
      url: discount.destinationUrl,
      description: discount.modalDescription,
      discount,
      settings: {
        ...link.settings,
        thumbnailUrl: discount.cardThumbnail ?? link.settings.thumbnailUrl,
      },
    };
  }).map((link) => {
    if (getContentType(link) !== "embed_post") {
      return link;
    }

    const embedPost = getEmbedPostData(link);
    return {
      ...link,
      title: embedPost.cardTitle,
      url: embedPost.ctaUrl,
      description: embedPost.description,
      embedPost,
      settings: {
        ...link.settings,
        thumbnailUrl: embedPost.cardThumbnail,
      },
    };
  }).map((link) => {
    if (getContentType(link) !== "form") {
      return link;
    }
    const form = getFormData(link);
    return {
      ...link,
      title: form.formTitle,
      description: form.intro,
      form,
    };
  }),
});
