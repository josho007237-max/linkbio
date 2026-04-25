import {
  BuilderData,
  BioLink,
  ContentType,
  DiscountCodeData,
  EmbedPostData,
  ExternalFormBlock,
  FormBlock,
  FormField,
  FormTemplate,
  LinkSettings,
  PromoGalleryBlock,
  UnifiedMenuItemDisplay,
} from "@/features/builder/types";

export const createId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_LINK_SETTINGS_STYLE: Pick<
  LinkSettings,
  | "style"
  | "textAlign"
  | "bannerRatio"
  | "imageFit"
  | "imageUrl"
  | "iconImageUrl"
  | "backgroundImageUrl"
  | "preserveLineBreaks"
  | "textPanelContent"
  | "openInNewTab"
  | "showBorder"
> = {
  style: "icon_left",
  textAlign: "left",
  bannerRatio: "3:1",
  imageFit: "cover",
  imageUrl: "",
  iconImageUrl: "",
  backgroundImageUrl: "",
  preserveLineBreaks: true,
  textPanelContent: "",
  openInNewTab: true,
  showBorder: true,
};

export const getLinkDisplaySettings = (link: BioLink) => ({
  ...DEFAULT_LINK_SETTINGS_STYLE,
  style: link.settings.style ?? link.settings.displayStyle ?? DEFAULT_LINK_SETTINGS_STYLE.style,
  bannerRatio: link.settings.bannerRatio ?? (link.settings as { imageAspect?: "3:1" | "2:1" }).imageAspect ?? DEFAULT_LINK_SETTINGS_STYLE.bannerRatio,
  backgroundImageUrl: link.settings.backgroundImageUrl ?? link.settings.imageUrl ?? "",
  iconImageUrl: link.settings.iconImageUrl ?? link.settings.imageUrl ?? "",
  ...link.settings,
});

export const getUnifiedMenuItemDisplay = (
  link: BioLink,
  sortOrder: number,
): UnifiedMenuItemDisplay => {
  const settings = getLinkDisplaySettings(link);
  return {
    id: link.id,
    style: settings.style,
    enabled: link.enabled,
    sortOrder: settings.sortOrder ?? sortOrder,
    title: link.title,
    description: link.description ?? "",
    linkUrl: link.url,
    openInNewTab: settings.openInNewTab,
    textAlign: settings.textAlign,
    imageUrl: settings.imageUrl,
    iconImageUrl: settings.iconImageUrl,
    backgroundImageUrl: settings.backgroundImageUrl,
    preserveLineBreaks: settings.preserveLineBreaks,
    bannerRatio: settings.bannerRatio,
    imageFit: settings.imageFit,
    titleSize: settings.titleSize,
    textColor: settings.textColor,
    backgroundColor: settings.backgroundColor,
    borderColor: settings.borderColor,
    showBorder: settings.showBorder,
    borderRadius: settings.borderRadius,
  };
};

export const createEmptyLink = (): BioLink => ({
  id: createId("link"),
  contentType: "link",
  title: "New Link",
  url: "https://",
  description: "",
  enabled: true,
  preOpenModal: {
    enabled: false,
    title: "Notice",
    description: "Please review before continuing.",
    primaryButtonLabel: "Continue",
    destinationUrl: "",
    showSecondaryButton: true,
    secondaryButtonLabel: "Close",
    dismissible: true,
    buttonStyle: "solid",
  },
  settings: {
    prioritize: false,
    locked: false,
    ...DEFAULT_LINK_SETTINGS_STYLE,
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
    ...DEFAULT_LINK_SETTINGS_STYLE,
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
    ...DEFAULT_LINK_SETTINGS_STYLE,
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
  deposit_issue: [
    { id: "user", label: "USER", type: "short_answer", required: true, placeholder: "กรอก USER" },
    {
      id: "registered_phone",
      label: "เบอร์โทรศัพท์ที่ลงทะเบียน",
      type: "phone",
      required: true,
      placeholder: "08X-XXX-XXXX",
    },
    {
      id: "bank_name",
      label: "Bank Name",
      type: "short_answer",
      required: true,
      placeholder: "ชื่อธนาคาร",
    },
    {
      id: "account_number",
      label: "Account Number",
      type: "short_answer",
      required: true,
      placeholder: "เลขที่บัญชี",
    },
    {
      id: "amount",
      label: "Amount",
      type: "short_answer",
      required: true,
      placeholder: "0.00",
    },
    {
      id: "slip",
      label: "แนบสลิปการทำรายการ",
      type: "file_image",
      required: true,
      placeholder: "",
    },
    {
      id: "transaction_time",
      label: "เวลาที่ทำรายการ",
      type: "time_hms",
      required: true,
      placeholder: "HH:MM:SS",
    },
    {
      id: "note",
      label: "หมายเหตุเพิ่มเติม",
      type: "paragraph",
      required: false,
      placeholder: "รายละเอียดเพิ่มเติม (ถ้ามี)",
    },
  ],
  withdraw_issue: [
    { id: "user", label: "USER", type: "short_answer", required: true, placeholder: "กรอก USER" },
    {
      id: "registered_phone",
      label: "เบอร์โทรศัพท์ที่ลงทะเบียน",
      type: "phone",
      required: true,
      placeholder: "08X-XXX-XXXX",
    },
    { id: "full_name", label: "ชื่อ-นามสกุล", type: "name", required: true, placeholder: "ชื่อจริง นามสกุล" },
    {
      id: "bank_name",
      label: "Bank Name",
      type: "short_answer",
      required: true,
      placeholder: "ชื่อธนาคาร",
    },
    {
      id: "account_number",
      label: "Account Number",
      type: "short_answer",
      required: true,
      placeholder: "เลขที่บัญชี",
    },
    {
      id: "amount",
      label: "Amount",
      type: "short_answer",
      required: true,
      placeholder: "0.00",
    },
    {
      id: "transaction_time",
      label: "เวลาที่ทำรายการ",
      type: "time_hms",
      required: true,
      placeholder: "HH:MM:SS",
    },
    {
      id: "note",
      label: "หมายเหตุเพิ่มเติม",
      type: "paragraph",
      required: false,
      placeholder: "รายละเอียดเพิ่มเติม (ถ้ามี)",
    },
  ],
};

export const getFormTemplateFields = (template: FormTemplate): FormField[] =>
  (FORM_TEMPLATE_FIELDS[template] ?? FORM_TEMPLATE_FIELDS.custom).map((field) => ({
    ...field,
    id:
      template === "deposit_issue" || template === "withdraw_issue"
        ? field.id
        : createId("form-field"),
    options: field.options ? [...field.options] : undefined,
  }));

export const createEmptyFormBlock = (template: FormTemplate = "email_signup"): BioLink => ({
  id: createId("form"),
  contentType: "form",
  title:
    template === "deposit_issue"
      ? "ฝากเงินไม่เข้า"
      : template === "withdraw_issue"
        ? "ถอนเงินไม่ได้"
        : "New Form",
  url: "https://example.com/form",
  description:
    template === "deposit_issue" || template === "withdraw_issue"
      ? "กรุณากรอกข้อมูลให้ครบถ้วน เพื่อให้เจ้าหน้าที่ดำเนินการตรวจสอบได้อย่างรวดเร็ว"
      : "Tap to open form.",
  enabled: true,
  form: {
    type: "form",
    template,
    layout: "classic",
    formTitle:
      template === "deposit_issue"
        ? "ฝากเงินไม่เข้า"
        : template === "withdraw_issue"
          ? "ถอนเงินไม่ได้"
          : "Join our list",
    intro:
      template === "deposit_issue" || template === "withdraw_issue"
        ? "กรุณากรอกข้อมูลให้ครบถ้วน เพื่อให้เจ้าหน้าที่ดำเนินการตรวจสอบได้อย่างรวดเร็ว"
        : "Fill in the form below.",
    outro:
      template === "deposit_issue" || template === "withdraw_issue"
        ? "ระบบได้รับข้อมูลของท่านเรียบร้อยแล้ว\nเจ้าหน้าที่กำลังดำเนินการตรวจสอบ กรุณารอสักครู่"
        : "Thank you. We received your submission.",
    submitLabel:
      template === "deposit_issue" || template === "withdraw_issue"
        ? "ส่งข้อมูลเพื่อตรวจสอบ"
        : "Submit",
    cancelLabel: template === "deposit_issue" || template === "withdraw_issue" ? "ยกเลิก" : "Cancel",
    termsPlaceholder: "",
    fields: getFormTemplateFields(template),
  },
  settings: {
    prioritize: false,
    locked: false,
    ...DEFAULT_LINK_SETTINGS_STYLE,
  },
});

export const createEmptyPromoGallery = (): BioLink => ({
  id: createId("promo-gallery"),
  contentType: "promo_gallery",
  title: "Promo Gallery",
  url: "",
  description: "",
  enabled: true,
  promoGallery: {
    type: "promo_gallery",
    title: "Promo Gallery",
    description: "",
    items: [
      {
        id: createId("promo-item"),
        imageUrl: "/placeholders/link-thumbnail-default.svg",
        title: "Promotion title",
        description: "Promotion details",
        badge: "",
        conditions: [],
        ctaLabel: "",
        ctaUrl: "",
        openInNewTab: true,
        active: true,
      },
    ],
  },
  settings: {
    prioritize: false,
    locked: false,
    ...DEFAULT_LINK_SETTINGS_STYLE,
  },
});

export const createEmptyExternalForm = (): BioLink => ({
  id: createId("external-form"),
  contentType: "external_form",
  title: "External Form",
  url: "https://docs.google.com/forms/",
  description: "Open external form.",
  enabled: true,
  externalForm: {
    type: "external_form",
    title: "External Form",
    description: "",
    formUrl: "https://docs.google.com/forms/",
    openMode: "new_tab",
    embedHtml: "",
    ctaLabel: "Open form",
    closeLabel: "Close",
    enabled: true,
    showOpenInBrowserButton: false,
  },
  settings: {
    prioritize: false,
    locked: false,
    ...DEFAULT_LINK_SETTINGS_STYLE,
  },
});

export const getContentType = (item: BioLink): ContentType =>
  item.contentType === "discount"
    ? "discount"
    : item.contentType === "embed_post"
      ? "embed_post"
      : item.contentType === "form"
        ? "form"
      : item.contentType === "promo_gallery"
        ? "promo_gallery"
      : item.contentType === "external_form"
        ? "external_form"
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
  cancelLabel: link.form?.cancelLabel ?? "Cancel",
  termsPlaceholder: link.form?.termsPlaceholder ?? "",
  fields: (() => {
    const template = link.form?.template ?? "custom";
    const currentFields =
      link.form?.fields && link.form.fields.length > 0
        ? link.form.fields.map((field) => ({
            ...field,
            options: field.options ? [...field.options] : undefined,
          }))
        : [];
    if (template !== "deposit_issue" && template !== "withdraw_issue") {
      return currentFields.length > 0 ? currentFields : getFormTemplateFields(template);
    }
    const requiredFields = getFormTemplateFields(template);
    const existingById = new Map(
      currentFields.map((field) => [field.id.trim().toLowerCase(), field] as const),
    );
    return requiredFields.map((required) => {
      const existing = existingById.get(required.id.trim().toLowerCase());
      if (!existing) {
        return required;
      }
      return {
        ...required,
        ...existing,
        id: required.id,
        label: required.label,
        type: required.type,
      };
    });
  })(),
});

export const getPromoGalleryData = (link: BioLink): PromoGalleryBlock => ({
  type: "promo_gallery",
  title: link.promoGallery?.title ?? link.title,
  description: link.promoGallery?.description ?? link.description ?? "",
  items: (link.promoGallery?.items ?? [])
    .map((item, index) => ({
      id: item.id || `promo-item-${index}`,
      imageUrl: item.imageUrl ?? "",
      title: item.title ?? "",
      description: item.description ?? "",
      badge: item.badge ?? "",
      conditions: (item.conditions ?? []).map((row, rowIndex) => ({
        id: row.id || `promo-condition-${index}-${rowIndex}`,
        label: row.label ?? "",
        value: row.value ?? "",
      })),
      ctaLabel: item.ctaLabel ?? "",
      ctaUrl: item.ctaUrl ?? "",
      openInNewTab: item.openInNewTab ?? true,
      active: item.active ?? true,
    })),
});

export const getExternalFormData = (link: BioLink): ExternalFormBlock => ({
  type: "external_form",
  title: link.externalForm?.title ?? link.title,
  description: link.externalForm?.description ?? link.description ?? "",
  formUrl: link.externalForm?.formUrl ?? link.url,
  openMode: link.externalForm?.openMode ?? "new_tab",
  embedHtml: link.externalForm?.embedHtml ?? "",
  ctaLabel: link.externalForm?.ctaLabel ?? "Open form",
  closeLabel: link.externalForm?.closeLabel ?? "Close",
  enabled: link.externalForm?.enabled ?? link.enabled,
  showOpenInBrowserButton: link.externalForm?.showOpenInBrowserButton ?? false,
});

export const getPreOpenModalData = (item: {
  preOpenModal?: BioLink["preOpenModal"];
}) => ({
  enabled: item.preOpenModal?.enabled ?? false,
  bannerImageUrl: item.preOpenModal?.bannerImageUrl ?? "",
  title: item.preOpenModal?.title ?? "Notice",
  description: item.preOpenModal?.description ?? "",
  primaryButtonLabel: item.preOpenModal?.primaryButtonLabel ?? "Continue",
  destinationUrl: item.preOpenModal?.destinationUrl ?? "",
  showSecondaryButton: item.preOpenModal?.showSecondaryButton ?? true,
  secondaryButtonLabel: item.preOpenModal?.secondaryButtonLabel ?? "Close",
  dismissible: item.preOpenModal?.dismissible ?? true,
  buttonStyle: item.preOpenModal?.buttonStyle ?? "solid",
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
  header: {
    ...data.header,
    publicHandle:
      typeof data.header.publicHandle === "string" && data.header.publicHandle.trim()
        ? data.header.publicHandle.trim()
        : typeof data.header.publicUsername === "string" && data.header.publicUsername.trim()
          ? data.header.publicUsername.trim()
          : data.header.username,
  },
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
        ...getLinkDisplaySettings(link),
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
        ...getLinkDisplaySettings(link),
        thumbnailUrl: embedPost.cardThumbnail,
      },
    };
  }).map((link) => {
    if (getContentType(link) !== "promo_gallery") {
      return link;
    }

    const promoGallery = getPromoGalleryData(link);
    return {
      ...link,
      title: promoGallery.title ?? link.title,
      description: promoGallery.description ?? link.description ?? "",
      promoGallery,
      settings: {
        ...link.settings,
        ...getLinkDisplaySettings(link),
      },
    };
  }).map((link) => {
    if (getContentType(link) !== "external_form") {
      return link;
    }

    const externalForm = getExternalFormData(link);
    return {
      ...link,
      title: externalForm.title ?? link.title,
      url: externalForm.formUrl ?? link.url,
      description: externalForm.description ?? link.description ?? "",
      externalForm,
      settings: {
        ...link.settings,
        ...getLinkDisplaySettings(link),
      },
    };
  }).map((link) => {
    if (getContentType(link) !== "form") {
      return {
        ...link,
        settings: {
          ...link.settings,
          ...getLinkDisplaySettings(link),
        },
      };
    }
    const form = getFormData(link);
    return {
      ...link,
      title: form.formTitle,
      description: form.intro,
      form,
      settings: {
        ...link.settings,
        ...getLinkDisplaySettings(link),
      },
    };
  }),
});
