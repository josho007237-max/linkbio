"use client";

import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import { ComponentType, FocusEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Globe,
  Link2,
  Lock,
  MessageCircle,
  Music2,
  SquarePlay,
  X,
} from "lucide-react";

import { BuilderData, FormField, SocialLink } from "@/features/builder/types";
import { ProfileHeader } from "@/components/profile/profile-header";
import {
  getContentType,
  getDiscountData,
  getEmbedPostData,
  getExternalFormData,
  getFormData,
  normalizeFormFieldType,
  getLinkDisplaySettings,
  getPromoGalleryData,
  getSortedVisibleLinks,
} from "@/features/builder/utils";
import {
  AVATAR_HEADER_FALLBACK_SRC,
  getAvatarHeaderRequestSrc,
  getAvatarHeaderSrc,
  getHeroHeaderKey,
  getHeroHeaderRequestSrc,
  getHeroHeaderSrc,
} from "@/features/builder/utils/header-media";
import {
  collectIndexedDbImageRefsFromBuilderData,
  getImageDataUrlByRef,
  hydrateBuilderDataWithIndexedDbImages,
} from "@/lib/local-storage/image-storage";
import { useI18n } from "@/i18n/use-i18n";
import { cn } from "@/lib/utils";

type MobilePreviewProps = {
  data: BuilderData;
  routeSlug?: string;
  mode?: "admin" | "public";
  onPublicLinkClick?: (
    linkId: string,
    eventType?: "cta" | "copy" | "modal_open",
  ) => void;
};

type PreviewHrefKind = "internal" | "external" | "invalid";
type PreviewHrefResult = {
  kind: PreviewHrefKind;
  href: string | null;
};
type XActivityChecklistState = {
  followed: boolean;
  reposted: boolean;
  commented: boolean;
};

type FormSubmissionValues = Record<string, string | string[]>;
type FormSubmissionErrors = Record<string, string>;
type FormFileSelection = {
  file: File;
  previewUrl: string;
  fileName: string;
};
type FormFilesByLink = Record<string, Record<string, FormFileSelection>>;

const WALLPAPER_FALLBACK_SRC = "/placeholders/wallpaper-default.svg";
const THUMBNAIL_FALLBACK_SRC = "/placeholders/link-thumbnail-default.svg";
const MAX_SUPPORT_SLIP_SIZE_BYTES = 5 * 1024 * 1024;
const SOCIAL_EMBED_VIEW_SCALE = 0.94;
const SOCIAL_EMBED_COMPENSATED_PERCENT = 100 / SOCIAL_EMBED_VIEW_SCALE;
const SOCIAL_EMBED_COMPENSATED_OFFSET_PERCENT =
  (100 - SOCIAL_EMBED_COMPENSATED_PERCENT) / 2;
const SAFE_EXTERNAL_HREF_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "sms:",
  "line:",
  "whatsapp:",
  "tg:",
]);
const WEB_EXTERNAL_HREF_PROTOCOLS = new Set(["http:", "https:"]);
const TIME_SEGMENT_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

const normalizeImageSrc = (
  value: string | null | undefined,
  fallback: string | null = null,
): string | null => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
};

const socialIconMap: Record<SocialLink["platform"], ComponentType<{ className?: string }>> = {
  instagram: Link2,
  tiktok: Music2,
  youtube: SquarePlay,
  x: X,
  facebook: MessageCircle,
  website: Globe,
};

const SocialVisual = ({ social }: { social: SocialLink }) => {
  const Icon = socialIconMap[social.platform];
  const iconSrc = normalizeImageSrc(social.iconImageUrl) ?? normalizeImageSrc(social.iconUrl);
  if (iconSrc) {
    return (
      <SafeImage
        src={iconSrc}
        alt=""
        width={24}
        height={24}
        className="max-h-full max-w-full object-contain"
      />
    );
  }
  return <Icon className="size-5" />;
};

const parsePreviewHref = (href: string): PreviewHrefResult => {
  const value = href.trim();

  if (!value) {
    return { kind: "invalid", href: null };
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return { kind: "internal", href: value };
  }

  try {
    const parsed = new URL(value.startsWith("//") ? `https:${value}` : value);
    if (!SAFE_EXTERNAL_HREF_PROTOCOLS.has(parsed.protocol)) {
      return { kind: "invalid", href: null };
    }
    if (WEB_EXTERNAL_HREF_PROTOCOLS.has(parsed.protocol) && !parsed.hostname) {
      return { kind: "invalid", href: null };
    }
    return { kind: "external", href: parsed.toString() };
  } catch {
    return { kind: "invalid", href: null };
  }
};

const isWebExternalHref = (
  parsedHref: PreviewHrefResult,
): parsedHref is { kind: "external"; href: string } => {
  if (parsedHref.kind !== "external" || !parsedHref.href) {
    return false;
  }
  try {
    const parsed = new URL(parsedHref.href);
    return WEB_EXTERNAL_HREF_PROTOCOLS.has(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const getExternalAnchorTargetProps = (
  parsedHref: PreviewHrefResult,
  openInNewTab = true,
): { target?: "_blank"; rel?: "noreferrer" } =>
  isWebExternalHref(parsedHref) && openInNewTab ? { target: "_blank", rel: "noreferrer" } : {};

const getYouTubeEmbedUrl = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    return null;
  } catch {
    return null;
  }
};

const getEmbedSrcFromProvider = (provider: string, sourceUrl: string): string | null => {
  if (provider === "youtube") {
    return getYouTubeEmbedUrl(sourceUrl);
  }
  if (provider === "tiktok" || provider === "facebook") {
    return sourceUrl;
  }
  return null;
};

const getProviderModalClass = (provider: string): string => {
  if (provider === "x") {
    return "max-w-[520px]";
  }
  return "max-w-[520px]";
};

const buildXEmbedSrcDoc = (embedCode: string): string => embedCode;

const extractXBlockquoteMarkup = (embedCode: string): string | null => {
  const match = embedCode.match(/<blockquote[\s\S]*?<\/blockquote>/i);
  return match ? match[0] : null;
};

const buildXBlockquoteFromUrl = (sourceUrl: string): string | null => {
  const parsed = parsePreviewHref(sourceUrl);
  if (!isWebExternalHref(parsed)) {
    return null;
  }
  return `<blockquote class="twitter-tweet"><a href="${parsed.href}"></a></blockquote>`;
};

const buildProviderEmbedSrcDoc = (
  provider: string,
  embedMode: string,
  embedCode: string,
): string | null => {
  if (!embedCode.trim() || embedMode !== "code") {
    return null;
  }
  if (provider === "x") {
    return null;
  }
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">${embedCode}</body></html>`;
};

const isEmailValid = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isPhoneValid = (value: string): boolean =>
  /^[+]?[0-9\s\-()]{7,20}$/.test(value.trim());

const isSupportTemplate = (template: string): template is "deposit_issue" | "withdraw_issue" =>
  template === "deposit_issue" || template === "withdraw_issue";

const getFieldLabelTokens = (label: string): string => label.trim().toLowerCase();

const isAmountField = (field: { id: string; label: string }): boolean => {
  const id = field.id.trim().toLowerCase();
  const label = getFieldLabelTokens(field.label);
  return id.includes("amount") || label.includes("amount") || label.includes("ยอดเงิน");
};

const getSupportFieldLabelKey = (
  field: { id: string; label: string },
): "bank_name" | "account_number" | "amount" | null => {
  const id = field.id.trim().toLowerCase();
  const label = getFieldLabelTokens(field.label);
  if (id.includes("bank_name") || label.includes("bank_name") || label.includes("ธนาคาร")) {
    return "bank_name";
  }
  if (
    id.includes("account_number") ||
    label.includes("account_number") ||
    label.includes("เลขที่บัญชี")
  ) {
    return "account_number";
  }
  if (isAmountField(field)) {
    return "amount";
  }
  return null;
};

const sanitizeAmountInput = (value: string): string => {
  const normalized = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = normalized.split(".");
  const safeInteger = integerPart.replace(/^0+(?=\d)/, "") || (integerPart ? "0" : "");
  const mergedDecimal = decimalParts.join("").slice(0, 2);
  if (normalized.includes(".")) {
    return `${safeInteger || "0"}.${mergedDecimal}`;
  }
  return safeInteger;
};

const parseDecimalAmount = (value: string): number | null => {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

type TimeParts = {
  hour: string;
  minute: string;
  second: string;
};

const getTimeParts = (value: string): TimeParts => {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return { hour: "", minute: "", second: "" };
  }
  return {
    hour: match[1],
    minute: match[2],
    second: match[3],
  };
};

const normalizeTimeInputValue = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const hhmm = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (hhmm) {
    return `${hhmm[1]}:${hhmm[2]}:00`;
  }
  const hhmmss = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/);
  if (hhmmss) {
    return `${hhmmss[1]}:${hhmmss[2]}:${hhmmss[3]}`;
  }
  return trimmed;
};

const buildTimeFromParts = (parts: TimeParts): string =>
  `${parts.hour || "00"}:${parts.minute || "00"}:${parts.second || "00"}`;

const getSupportFieldName = (
  field: { type: string; label: string },
  supportTemplate: "deposit_issue" | "withdraw_issue" | null,
): string | null => {
  if (!supportTemplate) {
    return null;
  }
  const label = getFieldLabelTokens(field.label);
  const normalizedFieldType = normalizeFormFieldType(field.type as FormField["type"]);
  if (normalizedFieldType === "image_upload") {
    return supportTemplate === "deposit_issue" ? "slip" : null;
  }
  if (normalizedFieldType === "time") {
    return "transactionTime";
  }
  if (label.includes("user") || label.includes("ยูส")) {
    return "username";
  }
  if (field.type === "phone") {
    return supportTemplate === "deposit_issue" ? "registeredPhone" : "phone";
  }
  if (field.type === "name" || label.includes("ชื่อ-นามสกุล") || label.includes("full name")) {
    return "fullName";
  }
  if (label.includes("หมายเหตุ") || label.includes("note")) {
    return "note";
  }
  return null;
};

const isSingleSelectFieldType = (fieldType: string): boolean =>
  normalizeFormFieldType(fieldType as FormField["type"]) === "single_select";

const isMultiSelectFieldType = (fieldType: string): boolean =>
  normalizeFormFieldType(fieldType as FormField["type"]) === "multi_select";

const isImageUploadFieldType = (fieldType: string): boolean =>
  normalizeFormFieldType(fieldType as FormField["type"]) === "image_upload";

const isTimeFieldType = (fieldType: string): boolean =>
  normalizeFormFieldType(fieldType as FormField["type"]) === "time";

const isTextAreaFieldType = (fieldType: string): boolean =>
  normalizeFormFieldType(fieldType as FormField["type"]) === "textarea";

const ensureXWidgetsScript = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-linkbio-x-widgets="true"]',
    );
    const finish = () => resolve();

    if (existing) {
      if ((window as { twttr?: { widgets?: { load?: () => void } } }).twttr?.widgets) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", finish, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.dataset.linkbioXWidgets = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", finish, { once: true });
    document.body.appendChild(script);
  });

const XEmbedRenderer = ({ markup }: { markup: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const current = containerRef.current;
    if (!current) {
      return;
    }

    current.innerHTML = buildXEmbedSrcDoc(markup);
    let canceled = false;
    void ensureXWidgetsScript().then(() => {
      if (canceled) {
        return;
      }
      const twttr = (
        window as unknown as {
          twttr?: { widgets?: { load?: (element?: Element) => void } };
        }
      ).twttr;
      twttr?.widgets?.load?.(current);
    });

    return () => {
      canceled = true;
    };
  }, [markup]);

  return (
    <div className="mx-auto w-full max-w-full rounded-lg border border-white/10 bg-white p-2 text-black">
      <div ref={containerRef} />
    </div>
  );
};

export const MobilePreview = ({
  data: rawData,
  routeSlug,
  mode = "admin",
  onPublicLinkClick,
}: MobilePreviewProps) => {
  const isAdminPreview = mode === "admin";
  const { t } = useI18n();
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const [resolvedImageRefs, setResolvedImageRefs] = useState<Record<string, string>>({});
  const data = useMemo(
    () => hydrateBuilderDataWithIndexedDbImages(rawData, resolvedImageRefs),
    [rawData, resolvedImageRefs],
  );
  const targetRouteSlug = useMemo(
    () => (routeSlug?.trim() ? routeSlug.trim().toLowerCase() : data.header.username),
    [data.header.username, routeSlug],
  );
  const urlSearchParams = useMemo(
    () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search)),
    [],
  );
  const visibleLinks = getSortedVisibleLinks(data);
  const [brokenAvatarSources, setBrokenAvatarSources] = useState<Record<string, true>>({});
  const [brokenWallpaperSources, setBrokenWallpaperSources] = useState<Record<string, true>>({});
  const [brokenThumbnailKeys, setBrokenThumbnailKeys] = useState<Record<string, true>>({});
  const [brokenHeroKeys, setBrokenHeroKeys] = useState<Record<string, true>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedEmbedLinkId, setCopiedEmbedLinkId] = useState<string | null>(null);
  const [activeDiscountId, setActiveDiscountId] = useState<string | null>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [activeExternalFormId, setActiveExternalFormId] = useState<string | null>(null);
  const [externalFormInlineClosedByLink, setExternalFormInlineClosedByLink] = useState<Record<string, boolean>>({});
  const [externalFormEmbedFailedByLink, setExternalFormEmbedFailedByLink] = useState<Record<string, boolean>>({});
  const [activePromoModal, setActivePromoModal] = useState<{ linkId: string; index: number } | null>(null);
  const [promoCarouselIndexByLink, setPromoCarouselIndexByLink] = useState<Record<string, number>>({});
  const promoCarouselRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activePreOpenKey, setActivePreOpenKey] = useState<string | null>(null);
  const [formValuesByLink, setFormValuesByLink] = useState<Record<string, FormSubmissionValues>>({});
  const [formErrorsByLink, setFormErrorsByLink] = useState<Record<string, FormSubmissionErrors>>({});
  const [formSubmittedByLink, setFormSubmittedByLink] = useState<Record<string, boolean>>({});
  const [formSubmittingByLink, setFormSubmittingByLink] = useState<Record<string, boolean>>({});
  const [formSubmitErrorByLink, setFormSubmitErrorByLink] = useState<Record<string, string>>({});
  const [formFilesByLink, setFormFilesByLink] = useState<FormFilesByLink>({});
  const [xActivityChecklistByLink, setXActivityChecklistByLink] = useState<
    Record<string, XActivityChecklistState>
  >({});

  const wallpaperRequestSrc = useMemo(
    () => normalizeImageSrc(data.theme.wallpaperUrl, WALLPAPER_FALLBACK_SRC) ?? WALLPAPER_FALLBACK_SRC,
    [data.theme.wallpaperUrl],
  );
  const pageFontFamily =
    data.theme.pageFont === "poppins"
      ? "'Poppins', 'Segoe UI', sans-serif"
      : data.theme.pageFont === "manrope"
        ? "'Manrope', 'Segoe UI', sans-serif"
        : data.theme.pageFont === "space_grotesk"
          ? "'Space Grotesk', 'Segoe UI', sans-serif"
          : "'Inter', 'Segoe UI', sans-serif";
  const wallpaperStyle = data.theme.wallpaperStyle ?? "image";
  const wallpaperSrc = brokenWallpaperSources[wallpaperRequestSrc]
    ? WALLPAPER_FALLBACK_SRC
    : wallpaperRequestSrc;
  const avatarRequestSrc = getAvatarHeaderRequestSrc(data.header);
  const avatarSrc = getAvatarHeaderSrc(data.header, brokenAvatarSources);
  const heroHeaderRequestSrc = getHeroHeaderRequestSrc(data.header);
  const heroHeaderKey = getHeroHeaderKey(heroHeaderRequestSrc);
  const heroHeaderSrc = getHeroHeaderSrc(data.header, brokenHeroKeys);
  const activeEmbedDismissible = useMemo(() => {
    if (!activeEmbedId) {
      return true;
    }
    const current = visibleLinks.find((item) => item.id === activeEmbedId);
    if (!current || getContentType(current) !== "embed_post") {
      return true;
    }
    return getEmbedPostData(current).dismissible;
  }, [activeEmbedId, visibleLinks]);

  const getPrefillValueForField = (
    field: { type: string; label: string },
    linkId: string,
  ): string => {
    if (!urlSearchParams) {
      return "";
    }
    const read = (...keys: string[]): string => {
      for (const key of keys) {
        const value = urlSearchParams.get(key);
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
      return "";
    };
    const label = getFieldLabelTokens(field.label);
    if (field.type === "email") {
      return read("email");
    }
    if (field.type === "phone") {
      return read("phone", "tel", "mobile");
    }
    if (field.type === "name") {
      return read("name", "full_name", "fullname");
    }
    if (field.type === "country") {
      return read("country");
    }
    if (field.type === "date" || field.type === "date_of_birth") {
      return read("date", "dob", "birth_date");
    }
    if (isTimeFieldType(field.type)) {
      const raw = read("time", "txn_time", "transaction_time");
      if (/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(raw)) {
        return raw;
      }
      const hhmmMatch = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (hhmmMatch) {
        return `${hhmmMatch[1]}:${hhmmMatch[2]}:00`;
      }
      return "";
    }
    if (label.includes("user") || label.includes("ยูส")) {
      return read("user", "username") || targetRouteSlug;
    }
    if (label.includes("บัญชี") || label.includes("account")) {
      return read("account", "account_no", "account_number");
    }
    if (label.includes("ชื่อ")) {
      return read("name", "full_name", "fullname");
    }
    return read(`field_${field.type}`, `field_${linkId}`);
  };

  useEffect(() => {
    const refs = collectIndexedDbImageRefsFromBuilderData(rawData).filter(
      (ref) => !resolvedImageRefs[ref],
    );
    if (refs.length === 0) {
      return;
    }

    let canceled = false;
    void Promise.all(
      refs.map(async (ref) => {
        const resolved = await getImageDataUrlByRef(ref);
        return { ref, resolved };
      }),
    ).then((results) => {
      if (canceled) {
        return;
      }

      const nextEntries = results.filter(
        (item): item is { ref: string; resolved: string } => Boolean(item.resolved),
      );
      if (nextEntries.length === 0) {
        return;
      }

      setResolvedImageRefs((current) => {
        const next = { ...current };
        for (const item of nextEntries) {
          next[item.ref] = item.resolved;
        }
        return next;
      });
    });

    return () => {
      canceled = true;
    };
  }, [rawData, resolvedImageRefs]);

  useEffect(() => {
    const candidateSrc = wallpaperRequestSrc;
    let canceled = false;
    const image = new window.Image();
    image.onerror = () => {
      if (!canceled) {
        setBrokenWallpaperSources((current) => ({
          ...current,
          [candidateSrc]: true,
        }));
      }
    };
    image.src = candidateSrc;

    return () => {
      canceled = true;
    };
  }, [wallpaperRequestSrc]);

  useEffect(() => {
    if (
      !activeDiscountId &&
      !activeEmbedId &&
      !activeFormId &&
      !activeExternalFormId &&
      !activePromoModal &&
      !activePreOpenKey
    ) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDiscountId(null);
        if (activeEmbedDismissible) {
          setActiveEmbedId(null);
        }
        setActiveFormId(null);
        setActiveExternalFormId(null);
        setActivePromoModal(null);
        setActivePreOpenKey(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeDiscountId,
    activeEmbedDismissible,
    activeEmbedId,
    activeFormId,
    activeExternalFormId,
    activePreOpenKey,
    activePromoModal,
  ]);

  useEffect(() => {
    if (activeFormId) {
      return;
    }
    setFormFilesByLink((current) => {
      const allLinks = Object.values(current);
      if (allLinks.length === 0) {
        return current;
      }
      allLinks.forEach((perLink) => {
        Object.values(perLink).forEach((selection) => {
          URL.revokeObjectURL(selection.previewUrl);
        });
      });
      return {};
    });
  }, [activeFormId]);

  useEffect(() => {
    if (mode !== "admin" || typeof window === "undefined") {
      return;
    }

    const resetPreviewScroll = () => {
      previewScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    };

    const onHashChange = () => {
      resetPreviewScroll();
    };

    const onAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const hashAnchor = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!hashAnchor) {
        return;
      }
      window.requestAnimationFrame(resetPreviewScroll);
    };

    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onAnchorClick, true);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onAnchorClick, true);
    };
  }, [mode]);

  const buttonStyleClass =
    data.buttonStyle.style === "glass"
      ? "backdrop-blur-md bg-white/15 border-white/30"
      : data.buttonStyle.style === "outline"
        ? "bg-transparent border-white/50"
        : "";
  const shadowClass =
    data.buttonStyle.shadowLevel === 3
      ? "shadow-2xl shadow-black/45"
      : data.buttonStyle.shadowLevel === 2
        ? "shadow-lg shadow-black/35"
        : data.buttonStyle.shadowLevel === 1
          ? "shadow-md shadow-black/20"
          : "";
  return (
    <div
      className={cn(
        "mx-auto w-full",
        isAdminPreview
          ? "max-w-[390px] rounded-[40px] border-8 border-zinc-900/95 bg-zinc-950 p-2 shadow-[0_18px_60px_rgba(2,6,23,0.5)]"
          : "max-w-[390px]",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          isAdminPreview
            ? "h-[760px] rounded-[30px] border border-white/15"
            : "rounded-[30px]",
        )}
        style={{
          backgroundColor: data.theme.pageBackground,
          color: data.theme.textColor,
          fontFamily: pageFontFamily,
        }}
      >
        {wallpaperStyle === "video" && normalizeImageSrc(data.theme.wallpaperVideoUrl) ? (
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-65"
            src={normalizeImageSrc(data.theme.wallpaperVideoUrl) ?? ""}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : wallpaperStyle !== "fill" ? (
          <div
            className={cn(
              "absolute inset-0 bg-cover bg-center opacity-55",
              wallpaperStyle === "blur" ? "scale-110 blur-sm" : "",
            )}
            style={{ backgroundImage: `url(${wallpaperSrc})` }}
          />
        ) : null}
        {wallpaperStyle === "gradient" ? (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${data.theme.pageBackground}, ${data.theme.buttonBackground})`,
            }}
          />
        ) : null}
        {wallpaperStyle === "pattern" ? (
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 2px, transparent 2px, transparent 10px)",
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/65" />

        <div
          ref={previewScrollRef}
          className={cn(
            "relative flex flex-col pb-6",
            isAdminPreview
              ? "h-full overflow-y-scroll overscroll-y-contain px-5 pt-6 [scrollbar-gutter:stable] [scrollbar-color:rgba(255,255,255,0.5)_rgba(255,255,255,0.12)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/45 hover:[&::-webkit-scrollbar-thumb]:bg-white/60"
              : "px-5 pt-6",
          )}
          style={isAdminPreview ? { scrollbarWidth: "thin" } : undefined}
        >
          {data.header.layout !== "none" ? (
            <ProfileHeader
              data={data}
              avatarSrc={avatarSrc}
              heroHeaderSrc={heroHeaderSrc}
              flushToTop={false}
              onAvatarError={() => {
                if (avatarSrc === AVATAR_HEADER_FALLBACK_SRC || brokenAvatarSources[avatarRequestSrc]) {
                  return;
                }
                setBrokenAvatarSources((current) => ({
                  ...current,
                  [avatarRequestSrc]: true,
                }));
              }}
              onHeroImageError={() => {
                if (brokenHeroKeys[heroHeaderKey]) {
                  return;
                }
                setBrokenHeroKeys((current) => ({
                  ...current,
                  [heroHeaderKey]: true,
                }));
              }}
            />
          ) : null}

          <div className={cn(data.header.layout === "none" ? "mt-0" : "mt-4", "flex justify-center gap-3")}>
              {data.socials
                .filter((social) => social.enabled)
                .map((social) => {
                  const parsedHref = parsePreviewHref(social.url);

                  if (parsedHref.kind !== "external" || !parsedHref.href) {
                    return (
                      <span
                        key={social.id}
                        aria-disabled="true"
                        className="inline-flex size-10 cursor-not-allowed items-center justify-center rounded-full border border-white/20 p-2 opacity-50"
                      >
                        <SocialVisual social={social} />
                      </span>
                    );
                  }

                  const socialPreOpenEnabled = mode === "public" && Boolean(social.preOpenModal?.enabled);
                  if (socialPreOpenEnabled) {
                    const preOpenKey = `social:${social.id}`;
                    const noticeTitle = social.preOpenModal?.title?.trim() || "Notice";
                    const noticeBody = social.preOpenModal?.description?.trim() || "";
                    const confirmLabel = social.preOpenModal?.primaryButtonLabel?.trim() || "Continue";
                    const secondaryLabel = social.preOpenModal?.secondaryButtonLabel?.trim() || t("form_submit_cancel");
                    const dismissible = social.preOpenModal?.dismissible ?? true;
                    const showSecondaryButton = social.preOpenModal?.showSecondaryButton ?? true;
                    const buttonStyle =
                      social.preOpenModal?.buttonStyle === "outline"
                        ? "border-white/50 bg-transparent"
                        : social.preOpenModal?.buttonStyle === "glow"
                          ? "border-emerald-300/60 bg-emerald-500/30 shadow-[0_0_22px_rgba(16,185,129,0.35)]"
                          : "border-white/30 bg-white/10";
                    const bannerSrc = normalizeImageSrc(social.preOpenModal?.bannerImageUrl);
                    const destinationOverride = parsePreviewHref(social.preOpenModal?.destinationUrl?.trim() || "");
                    const targetHref =
                      destinationOverride.kind === "external" && destinationOverride.href
                        ? destinationOverride.href
                        : parsedHref.href;
                    return (
                      <div key={social.id}>
                        <button
                          type="button"
                          className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 p-2 transition hover:bg-white/10"
                          onClick={() => setActivePreOpenKey(preOpenKey)}
                        >
                          <SocialVisual social={social} />
                        </button>
                        {activePreOpenKey === preOpenKey ? (
                          <div
                            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
                            onClick={() => {
                              if (dismissible) {
                                setActivePreOpenKey(null);
                              }
                            }}
                          >
                            <div
                              className="mx-auto flex max-h-[82dvh] w-[calc(100%-16px)] max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:w-[calc(100%-24px)] sm:p-5 md:p-6"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <h3 className="text-base font-bold leading-tight sm:text-xl">{noticeTitle}</h3>
                                {dismissible ? (
                                  <button
                                    type="button"
                                    className="rounded-md border border-white/25 p-1"
                                    onClick={() => setActivePreOpenKey(null)}
                                    aria-label={t("embed_post_action_close")}
                                  >
                                    <X className="size-4" />
                                  </button>
                                ) : null}
                              </div>
                              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1">
                                {bannerSrc ? (
                                  <SafeImage
                                    src={bannerSrc}
                                    alt=""
                                    width={480}
                                    height={240}
                                    className="mb-3 w-full rounded-xl border border-white/20 object-cover"
                                  />
                                ) : null}
                                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-200 sm:text-base">
                                  {noticeBody}
                                </p>
                                <div className={cn("mt-4 grid grid-cols-1 gap-2", showSecondaryButton && "sm:grid-cols-2")}>
                                  <button
                                    type="button"
                                    className={cn(
                                      "w-full min-h-12 rounded-full border px-5 text-sm font-semibold sm:text-base",
                                      buttonStyle,
                                    )}
                                    onClick={() => {
                                      setActivePreOpenKey(null);
                                      onPublicLinkClick?.(social.id, "cta");
                                      window.open(targetHref, "_blank", "noopener,noreferrer");
                                    }}
                                  >
                                    {confirmLabel}
                                  </button>
                                  {showSecondaryButton ? (
                                    <button
                                      type="button"
                                      className="w-full min-h-12 rounded-full border border-white/20 px-5 text-sm font-semibold sm:text-base"
                                      onClick={() => setActivePreOpenKey(null)}
                                    >
                                      {secondaryLabel}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <a
                      key={social.id}
                      href={parsedHref.href}
                      {...getExternalAnchorTargetProps(parsedHref)}
                      className="inline-flex size-10 items-center justify-center rounded-full border border-white/25 p-2 transition hover:bg-white/10"
                      onClick={() => {
                        if (mode === "public") {
                          onPublicLinkClick?.(social.id, "cta");
                        }
                      }}
                    >
                      <SocialVisual social={social} />
                    </a>
                  );
                })}
          </div>

          <div className="mt-5 space-y-3 pb-6">
            {visibleLinks.map((link) => {
              const thumbnailSrc =
                normalizeImageSrc(link.settings.thumbnailUrl, THUMBNAIL_FALLBACK_SRC) ??
                THUMBNAIL_FALLBACK_SRC;
              const displaySettings = getLinkDisplaySettings(link);
              const styleImageSrc =
                normalizeImageSrc(displaySettings.imageUrl, thumbnailSrc) ?? thumbnailSrc;
              const iconImageSrc =
                normalizeImageSrc(displaySettings.iconImageUrl, styleImageSrc) ?? styleImageSrc;
              const backgroundImageSrc =
                normalizeImageSrc(displaySettings.backgroundImageUrl, styleImageSrc) ?? styleImageSrc;
              const activeStyle = displaySettings.style ?? "icon_left";
              const openInNewTab = displaySettings.openInNewTab ?? true;
              const imageBrightness = Math.min(
                200,
                Math.max(0, displaySettings.imageBrightness ?? 100),
              );
              const imageContrast = Math.min(
                200,
                Math.max(0, displaySettings.imageContrast ?? 100),
              );
              const imageSaturation = Math.min(
                200,
                Math.max(0, displaySettings.imageSaturation ?? 100),
              );
              const imageOverlayExtraOpacity = Math.min(
                100,
                Math.max(0, displaySettings.overlayOpacity ?? 0),
              );
              const imageFilterStyle = {
                filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%) saturate(${imageSaturation}%)`,
              } as const;
              const baseImageOverlayOpacity = activeStyle === "image_banner" ? 35 : 0;
              const resolvedImageOverlayOpacity =
                Math.min(100, Math.max(0, baseImageOverlayOpacity + imageOverlayExtraOpacity)) / 100;
              const styleImageKey = `${link.id}::style::${styleImageSrc}`;
              const safeStyleImageSrc = brokenThumbnailKeys[styleImageKey]
                ? THUMBNAIL_FALLBACK_SRC
                : styleImageSrc;
              const iconImageKey = `${link.id}::icon::${iconImageSrc}`;
              const safeIconImageSrc = brokenThumbnailKeys[iconImageKey]
                ? THUMBNAIL_FALLBACK_SRC
                : iconImageSrc;
              const backgroundImageKey = `${link.id}::bg::${backgroundImageSrc}`;
              const safeBackgroundImageSrc = brokenThumbnailKeys[backgroundImageKey]
                ? THUMBNAIL_FALLBACK_SRC
                : backgroundImageSrc;
              const textAlignClass =
                displaySettings.textAlign === "center"
                  ? "text-center items-center"
                  : displaySettings.textAlign === "right"
                    ? "text-right items-end"
                    : "text-left items-start";
              const isImageFullStyle = activeStyle === "image_banner";
              const isTextPanelStyle = activeStyle === "text_panel";
              const className = cn(
                "w-full border font-semibold backdrop-blur-sm transition hover:brightness-105",
                isImageFullStyle
                  ? "relative overflow-hidden p-0"
                  : isTextPanelStyle
                    ? cn(
                        "px-5 py-5 sm:px-6 sm:py-6",
                        isAdminPreview ? "text-sm" : "text-base sm:text-lg",
                      )
                    : cn(
                        "flex items-center gap-3",
                        isAdminPreview ? "px-4 py-3 text-sm" : "p-4 text-sm sm:p-5 sm:text-base md:p-6",
                      ),
                data.buttonStyle.uppercase && "uppercase tracking-wide",
                data.buttonStyle.shadow && shadowClass,
                buttonStyleClass,
              );
              const style = {
                backgroundColor:
                  displaySettings.backgroundColor ||
                  (data.buttonStyle.style === "outline"
                    ? "transparent"
                    : data.buttonStyle.style === "glass"
                      ? "rgba(255,255,255,0.12)"
                      : data.theme.buttonBackground),
                color: displaySettings.textColor || data.theme.buttonTextColor,
                borderRadius: `${displaySettings.borderRadius ?? data.theme.buttonRadius}px`,
                borderColor:
                  displaySettings.showBorder === false
                    ? "transparent"
                    : displaySettings.borderColor || "rgba(255,255,255,0.25)",
              } as const;
              const parsedHref = parsePreviewHref(link.url);
              const isDiscount = getContentType(link) === "discount";
              const isEmbedPost = getContentType(link) === "embed_post";
              const isForm = getContentType(link) === "form";
              const isExternalForm = getContentType(link) === "external_form";
              const isPromoGallery = getContentType(link) === "promo_gallery";
              const discount = getDiscountData(link);
              const embedPost = getEmbedPostData(link);
              const form = getFormData(link);
              const externalForm = getExternalFormData(link);
              const promoGallery = getPromoGalleryData(link);
              const lockBadge = link.settings.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/10 px-2 py-1 text-[10px]">
                  <Lock className="size-3" />
                  {link.settings.lockMessage || t("preview_locked")}
                </span>
              ) : null;

              const renderStyledButtonContent = ({
                title,
                description,
                panelText,
              }: {
                title?: string;
                description?: string;
                panelText?: string;
              }) => {
                if (activeStyle === "text_only") {
                  return (
                    <div className={cn("flex w-full flex-col gap-1", textAlignClass)}>
                      {title ? (
                        <p className="w-full text-sm font-semibold sm:text-base">{title}</p>
                      ) : null}
                      {lockBadge}
                    </div>
                  );
                }

                if (activeStyle === "image_banner") {
                  return (
                    <div
                      className={cn(
                        "relative w-full",
                        displaySettings.bannerRatio === "2:1" ? "aspect-[2/1]" : "aspect-[3/1]",
                      )}
                    >
                      <div className="absolute inset-0" style={imageFilterStyle}>
                        <SafeImage
                          src={safeBackgroundImageSrc}
                          alt=""
                          width={720}
                          height={360}
                          className={cn(
                            "absolute inset-0 h-full w-full",
                            displaySettings.imageFit === "contain" ? "object-contain" : "object-cover",
                          )}
                          onError={() => {
                            if (
                              safeBackgroundImageSrc === THUMBNAIL_FALLBACK_SRC ||
                              brokenThumbnailKeys[backgroundImageKey]
                            ) {
                              return;
                            }
                            setBrokenThumbnailKeys((current) => ({ ...current, [backgroundImageKey]: true }));
                          }}
                        />
                      </div>
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: `rgba(0,0,0,${resolvedImageOverlayOpacity})` }}
                      />
                      <div className="relative z-[1] flex h-full w-full flex-col justify-center gap-1 px-4 py-3 text-left text-white sm:px-5">
                        {title ? (
                          <p
                            className={cn(
                              "font-semibold",
                              displaySettings.titleSize ? "" : "text-base sm:text-lg",
                            )}
                            style={displaySettings.titleSize ? { fontSize: `${displaySettings.titleSize}px` } : undefined}
                          >
                            {title}
                          </p>
                        ) : null}
                        {description ? <p className="line-clamp-2 text-xs opacity-90 sm:text-sm">{description}</p> : null}
                        {lockBadge}
                      </div>
                    </div>
                  );
                }

                if (activeStyle === "media_card") {
                  return (
                    <div className="flex w-full items-center gap-3">
                      <div className="h-20 w-20 shrink-0" style={imageFilterStyle}>
                        <SafeImage
                          src={safeStyleImageSrc}
                          alt=""
                          className="h-20 w-20 rounded-lg border border-black/10 object-cover"
                          width={80}
                          height={80}
                          onError={() => {
                            if (
                              safeStyleImageSrc === THUMBNAIL_FALLBACK_SRC ||
                              brokenThumbnailKeys[styleImageKey]
                            ) {
                              return;
                            }
                            setBrokenThumbnailKeys((current) => ({ ...current, [styleImageKey]: true }));
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        {title ? <p className="text-lg font-semibold leading-tight">{title}</p> : null}
                        {description ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed opacity-80 sm:text-sm">
                            {description}
                          </p>
                        ) : null}
                        {lockBadge ? <div className="mt-2">{lockBadge}</div> : null}
                      </div>
                    </div>
                  );
                }

                if (activeStyle === "text_panel") {
                  return (
                    <div className={cn("flex w-full flex-col gap-2", textAlignClass)}>
                      {title ? <p className="w-full text-base font-semibold sm:text-lg">{title}</p> : null}
                      {panelText || description ? (
                        <p
                          className={cn(
                            "w-full text-sm leading-relaxed opacity-90 sm:text-base",
                            displaySettings.preserveLineBreaks === false ? "whitespace-normal" : "whitespace-pre-wrap",
                          )}
                        >
                          {panelText || description}
                        </p>
                      ) : null}
                      {lockBadge}
                    </div>
                  );
                }

                return (
                  <>
                    <SafeImage
                      src={safeIconImageSrc}
                      alt=""
                      className="size-10 rounded-full border border-black/10 object-cover"
                      width={40}
                      height={40}
                      onError={() => {
                        if (
                          safeIconImageSrc === THUMBNAIL_FALLBACK_SRC ||
                          brokenThumbnailKeys[iconImageKey]
                        ) {
                          return;
                        }
                        setBrokenThumbnailKeys((current) => ({ ...current, [iconImageKey]: true }));
                      }}
                    />
                    <div className={cn("min-w-0 flex-1", textAlignClass)}>
                      {title ? <p className="truncate text-sm font-semibold sm:text-base">{title}</p> : null}
                      {description ? (
                        <p className="truncate text-xs leading-relaxed opacity-80 sm:text-sm">{description}</p>
                      ) : null}
                    </div>
                    {lockBadge}
                  </>
                );
              };

              const renderDiscountCta = (
                parsedDiscountHref: PreviewHrefResult,
              ) => {
                const ctaLabel = discount.ctaButtonLabel || t("preview_disabled_cta");
                if (!parsedDiscountHref.href || parsedDiscountHref.kind === "invalid") {
                  return (
                    <span className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-5 text-sm font-semibold opacity-65 min-h-12 sm:w-auto sm:text-base">
                      {t("preview_disabled_cta")}
                    </span>
                  );
                }

                if (parsedDiscountHref.kind === "internal") {
                  return (
                    <Link
                      href={parsedDiscountHref.href}
                      className="inline-flex w-full items-center justify-center rounded-full border border-white/35 px-5 text-sm font-semibold min-h-12 sm:w-auto sm:text-base"
                      onClick={() => {
                        if (discount.analyticsHooks?.trackCtaClick ?? true) {
                          onPublicLinkClick?.(link.id, "cta");
                        }
                      }}
                    >
                      {ctaLabel}
                    </Link>
                  );
                }

                return (
                  <a
                    href={parsedDiscountHref.href}
                    {...getExternalAnchorTargetProps(parsedDiscountHref)}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/35 px-5 text-sm font-semibold min-h-12 sm:w-auto sm:text-base"
                    onClick={() => {
                      if (discount.analyticsHooks?.trackCtaClick ?? true) {
                        onPublicLinkClick?.(link.id, "cta");
                      }
                    }}
                  >
                    {ctaLabel}
                  </a>
                );
              };
              const content = renderStyledButtonContent({
                title: link.title,
                description: link.description,
                panelText: displaySettings.textPanelContent,
              });

              if (isDiscount) {
                const code = discount.discountCode ?? "";
                const destinationParsed = parsePreviewHref(discount.destinationUrl);
                const heroSrc =
                  normalizeImageSrc(discount.modalHeroImage, THUMBNAIL_FALLBACK_SRC) ??
                  THUMBNAIL_FALLBACK_SRC;
                const heroKey = `${link.id}::hero::${heroSrc}`;
                const safeHeroSrc = brokenHeroKeys[heroKey] ? THUMBNAIL_FALLBACK_SRC : heroSrc;
                return (
                  <div key={link.id}>
                    <button
                      type="button"
                      className={className}
                      style={style}
                      onClick={() => {
                        setActiveDiscountId(link.id);
                        setActiveEmbedId(null);
                        setActiveExternalFormId(null);
                        setActivePromoModal(null);
                        setActivePreOpenKey(null);
                        if (discount.analyticsHooks?.trackModalOpen ?? true) {
                          onPublicLinkClick?.(link.id, "modal_open");
                        }
                      }}
                    >
                      {renderStyledButtonContent({
                        title: discount.cardTitle || link.title,
                        description: discount.modalDescription || t("discount_open_details"),
                        panelText:
                          displaySettings.textPanelContent ||
                          `${discount.cardTitle || link.title}\n${discount.modalDescription || ""}`,
                      })}
                    </button>

                    {activeDiscountId === link.id ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
                        onClick={() => setActiveDiscountId(null)}
                      >
                        <div
                          className="mx-auto flex max-h-[88dvh] w-[calc(100%-24px)] max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:p-5 md:p-6"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="text-lg font-bold leading-tight sm:text-xl md:text-2xl">
                              {discount.modalTitle}
                            </h3>
                            <button
                              type="button"
                              className="rounded-md border border-white/25 p-1"
                              onClick={() => setActiveDiscountId(null)}
                              aria-label={t("discount_close_button_label")}
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                          <div className="min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                          <div
                            className="relative w-full overflow-hidden rounded-2xl border border-white/20"
                            style={{ aspectRatio: "4 / 3" }}
                          >
                            <SafeImage
                              src={safeHeroSrc}
                              alt=""
                              className="h-full w-full object-cover"
                              width={1200}
                              height={900}
                              onError={() => {
                                if (
                                  safeHeroSrc === THUMBNAIL_FALLBACK_SRC ||
                                  brokenHeroKeys[heroKey]
                                ) {
                                  return;
                                }
                                setBrokenHeroKeys((current) => ({ ...current, [heroKey]: true }));
                              }}
                            />
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-zinc-200 sm:text-base">
                            {discount.modalDescription}
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                            <button
                              type="button"
                              className="w-full min-h-12 rounded-full border border-white/30 px-5 text-sm font-semibold sm:text-base"
                              onClick={async () => {
                                if (!code || typeof navigator === "undefined" || !navigator.clipboard) {
                                  return;
                                }
                                await navigator.clipboard.writeText(code);
                                if (discount.analyticsHooks?.trackCodeCopy ?? true) {
                                  onPublicLinkClick?.(link.id, "copy");
                                }
                                setCopiedCodeId(link.id);
                                window.setTimeout(() => {
                                  setCopiedCodeId((current) => (current === link.id ? null : current));
                                }, 1500);
                              }}
                            >
                              {discount.copyButtonLabel}: {code || "--"}
                            </button>
                            {renderDiscountCta(destinationParsed)}
                          </div>
                          {destinationParsed.kind === "invalid" ? (
                            <p className="mt-2 text-[11px] text-amber-300">
                              {t("discount_invalid_url_message")}
                            </p>
                          ) : null}
                          <p className="mt-2 text-[11px] text-zinc-300">
                            {copiedCodeId === link.id
                              ? t("discount_copy_success_message")
                              : t("preview_copy_code")}
                          </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (isEmbedPost) {
                const parsedCtaHref = parsePreviewHref(embedPost.ctaUrl);
                const parsedSourceHref = parsePreviewHref(embedPost.sourceUrl);
                const isXProvider = embedPost.provider === "x";
                const providerModalClass = getProviderModalClass(embedPost.provider);
                const providerEmbedSrcDoc = buildProviderEmbedSrcDoc(
                  embedPost.provider,
                  embedPost.embedMode,
                  embedPost.embedCode,
                );
                const xEmbedMarkup = isXProvider
                  ? embedPost.embedMode === "code"
                    ? extractXBlockquoteMarkup(embedPost.embedCode)
                    : buildXBlockquoteFromUrl(embedPost.sourceUrl)
                  : null;
                const hasValidSourceInput =
                  embedPost.embedMode === "code"
                    ? isXProvider
                      ? Boolean(xEmbedMarkup)
                      : Boolean(embedPost.embedCode.trim())
                    : isWebExternalHref(parsedSourceHref);
                const iframeSrc = embedPost.embedMode === "url" && isWebExternalHref(parsedSourceHref)
                  ? getEmbedSrcFromProvider(embedPost.provider, parsedSourceHref.href)
                  : null;
                const embedUnavailable =
                  isXProvider
                    ? !xEmbedMarkup
                    : !hasValidSourceInput ||
                      (embedPost.embedMode === "url" && embedPost.provider === "youtube" && !iframeSrc);
                const embedActionClass =
                  "inline-flex h-11 w-full items-center justify-center rounded-full border px-4 text-center text-sm font-semibold sm:h-12 sm:px-5 sm:text-base";
                const parsedSourceButtonHref = parsePreviewHref(
                  embedPost.sourceButtonUrl || embedPost.sourceUrl,
                );
                const checklistItems: Array<{
                  key: keyof XActivityChecklistState;
                  label: string;
                  visible: boolean;
                }> = [
                  {
                    key: "followed",
                    label: embedPost.checklistItem1Label || "Followed",
                    visible: embedPost.showChecklistItem1,
                  },
                  {
                    key: "reposted",
                    label: embedPost.checklistItem2Label || "Reposted",
                    visible: embedPost.showChecklistItem2,
                  },
                  {
                    key: "commented",
                    label: embedPost.checklistItem3Label || "Commented",
                    visible: embedPost.showChecklistItem3,
                  },
                ];

                const renderEmbedSourceButton = () => {
                  if (!embedPost.showSourceButton) {
                    return null;
                  }
                  const label = embedPost.sourceButtonLabel || t("embed_post_action_view_on_platform");
                  if (!embedPost.sourceButtonEnabled) {
                    return (
                      <button
                        type="button"
                        className={`${embedActionClass} cursor-not-allowed border-white/30 opacity-65`}
                        disabled
                      >
                        {label}
                      </button>
                    );
                  }
                  if (!parsedSourceButtonHref.href || parsedSourceButtonHref.kind === "invalid") {
                    return (
                      <span className={`${embedActionClass} border-white/30 opacity-65`}>
                        {label}
                      </span>
                    );
                  }
                  if (parsedSourceButtonHref.kind === "internal") {
                    return (
                      <Link
                        href={parsedSourceButtonHref.href}
                        className={`${embedActionClass} border-white/30`}
                        onClick={() => onPublicLinkClick?.(link.id, "cta")}
                      >
                        {label}
                      </Link>
                    );
                  }
                  return (
                    <a
                      href={parsedSourceButtonHref.href}
                      {...getExternalAnchorTargetProps(
                        parsedSourceButtonHref,
                        embedPost.sourceButtonOpenInNewTab,
                      )}
                      className={`${embedActionClass} border-white/30`}
                      onClick={() => onPublicLinkClick?.(link.id, "cta")}
                    >
                      {label}
                    </a>
                  );
                };

                const renderEmbedCta = () => {
                  if (!embedPost.showCtaButton) {
                    return null;
                  }
                  const label = embedPost.ctaButtonLabel || t("embed_post_action_view_on_platform");
                  if (!embedPost.ctaButtonEnabled) {
                    return (
                      <button
                        type="button"
                        className={`${embedActionClass} cursor-not-allowed border-white/30 opacity-65`}
                        disabled
                      >
                        {label}
                      </button>
                    );
                  }
                  if (!parsedCtaHref.href || parsedCtaHref.kind === "invalid") {
                    return (
                      <span className={`${embedActionClass} border-white/30 opacity-65`}>
                        {label}
                      </span>
                    );
                  }

                  if (parsedCtaHref.kind === "internal") {
                    return (
                      <Link
                        href={parsedCtaHref.href}
                        className={`${embedActionClass} border-white/35`}
                        onClick={() => onPublicLinkClick?.(link.id, "cta")}
                      >
                        {label}
                      </Link>
                    );
                  }

                  return (
                    <a
                      href={parsedCtaHref.href}
                      {...getExternalAnchorTargetProps(parsedCtaHref, embedPost.ctaButtonOpenInNewTab)}
                      className={`${embedActionClass} border-white/35`}
                      onClick={() => onPublicLinkClick?.(link.id, "cta")}
                    >
                      {label}
                    </a>
                  );
                };

                return (
                  <div key={link.id}>
                    <button
                      type="button"
                      className={className}
                      style={style}
                      onClick={() => {
                        setActiveEmbedId(link.id);
                        setActiveDiscountId(null);
                        setActiveExternalFormId(null);
                        setActivePromoModal(null);
                        setActivePreOpenKey(null);
                        onPublicLinkClick?.(link.id, "modal_open");
                      }}
                    >
                      {renderStyledButtonContent({
                        title: embedPost.cardTitle || link.title,
                        description: embedPost.description || t("embed_post_public_open_in_modal"),
                        panelText:
                          displaySettings.textPanelContent ||
                          `${embedPost.cardTitle || link.title}\n${embedPost.description || ""}`,
                      })}
                    </button>

                    {activeEmbedId === link.id ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
                        onClick={() => {
                          if (embedPost.dismissible) {
                            setActiveEmbedId(null);
                          }
                        }}
                      >
                        <div
                          className={cn(
                            "mx-auto flex max-h-[88dvh] w-[calc(100%-16px)] max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:w-[calc(100%-24px)] sm:p-5 md:p-6",
                            providerModalClass,
                          )}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3 sm:gap-3">
                            {embedPost.showModalTitle ? (
                              <h3 className="text-base font-bold leading-tight sm:text-xl md:text-2xl">
                                {embedPost.modalTitle || embedPost.cardTitle}
                              </h3>
                            ) : (
                              <span />
                            )}
                            {embedPost.dismissible && embedPost.showTopRightDismissButton ? (
                              <button
                                type="button"
                                className="rounded-md border border-white/25 p-1"
                                onClick={() => setActiveEmbedId(null)}
                                aria-label={t("embed_post_action_close")}
                              >
                                <X className="size-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">

                          <div
                            className={cn(
                              "relative w-full min-h-[420px] h-[420px] overflow-hidden rounded-[20px] border border-white/15 bg-black/25 sm:min-h-[520px] sm:h-[520px] sm:rounded-[24px] md:min-h-[640px] md:h-[640px]",
                            )}
                          >
                            <div
                              className="absolute top-0"
                              style={{
                                left: `${SOCIAL_EMBED_COMPENSATED_OFFSET_PERCENT}%`,
                                width: `${SOCIAL_EMBED_COMPENSATED_PERCENT}%`,
                                height: `${SOCIAL_EMBED_COMPENSATED_PERCENT}%`,
                                transform: `scale(${SOCIAL_EMBED_VIEW_SCALE})`,
                                transformOrigin: "top center",
                              }}
                            >
                              {embedUnavailable ? (
                                <div className="flex h-full w-full items-center justify-center border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200">
                                  {t("embed_post_public_unavailable")}
                                </div>
                              ) : isXProvider && xEmbedMarkup ? (
                                <div className="h-full w-full overflow-auto">
                                  <XEmbedRenderer markup={xEmbedMarkup} />
                                </div>
                              ) : embedPost.embedMode === "code" ? (
                                <iframe
                                  title={embedPost.modalTitle || embedPost.cardTitle}
                                  className="h-full w-full border border-white/10 bg-white"
                                  sandbox="allow-scripts allow-same-origin allow-popups"
                                  srcDoc={
                                    providerEmbedSrcDoc ??
                                    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">${embedPost.embedCode}</body></html>`
                                  }
                                />
                              ) : iframeSrc ? (
                                <iframe
                                  title={embedPost.modalTitle || embedPost.cardTitle}
                                  className="h-full w-full border border-white/10 bg-black"
                                  src={iframeSrc}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200">
                                  {t("embed_post_public_unavailable")}
                                </div>
                              )}
                            </div>
                          </div>

                          {embedPost.showDescription && embedPost.description ? (
                            <p className="px-1 py-3 text-sm text-zinc-200 sm:px-5 sm:py-4 sm:text-base">
                              {embedPost.description}
                            </p>
                          ) : null}
                          {isXProvider ? (
                            <>
                              {embedPost.showChecklist && checklistItems.some((item) => item.visible) ? (
                                <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-zinc-200 sm:mt-4">
                                  <p className="mb-2 font-medium">
                                    {embedPost.checklistTitle || "Activity checklist (local confirmation only)"}
                                  </p>
                                  {checklistItems.map(({ key: activityKey, label, visible }) => {
                                    if (!visible) {
                                      return null;
                                    }

                                  const currentState = xActivityChecklistByLink[link.id] ?? {
                                    followed: false,
                                    reposted: false,
                                    commented: false,
                                  };
                                  return (
                                    <label key={activityKey} className="mt-1 flex items-center gap-2 first:mt-0">
                                      <input
                                        type="checkbox"
                                        checked={currentState[activityKey]}
                                        onChange={(event) => {
                                          setXActivityChecklistByLink((current) => ({
                                            ...current,
                                            [link.id]: {
                                              ...(current[link.id] ?? {
                                                followed: false,
                                                reposted: false,
                                                commented: false,
                                              }),
                                              [activityKey]: event.target.checked,
                                            },
                                          }));
                                        }}
                                      />
                                      <span>{label}</span>
                                    </label>
                                  );
                                })}
                                </div>
                              ) : null}
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:mx-5 sm:mb-5 sm:mt-4 sm:grid-cols-2">
                                {renderEmbedSourceButton()}
                                {renderEmbedCta()}
                                {embedPost.showCloseButton ? (
                                  <button
                                    type="button"
                                    className={`${embedActionClass} border-white/30 sm:col-span-2`}
                                    onClick={() => {
                                      if (embedPost.dismissible && embedPost.closeButtonEnabled) {
                                        setActiveEmbedId(null);
                                        setActiveExternalFormId(null);
                                      }
                                    }}
                                    disabled={!embedPost.dismissible || !embedPost.closeButtonEnabled}
                                  >
                                    {embedPost.closeButtonLabel || t("embed_post_action_close")}
                                  </button>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:mx-5 sm:mb-5 sm:mt-4 sm:grid-cols-2">
                                {renderEmbedSourceButton()}
                                <button
                                  type="button"
                                  className={`${embedActionClass} border-white/30`}
                                  onClick={async () => {
                                    if (
                                      !parsedSourceHref.href ||
                                      typeof navigator === "undefined" ||
                                      !navigator.clipboard
                                    ) {
                                      setCopiedEmbedLinkId(`error:${link.id}`);
                                      window.setTimeout(() => setCopiedEmbedLinkId(null), 1400);
                                      return;
                                    }
                                    try {
                                      await navigator.clipboard.writeText(parsedSourceHref.href);
                                      setCopiedEmbedLinkId(link.id);
                                      window.setTimeout(() => {
                                        setCopiedEmbedLinkId((current) => (current === link.id ? null : current));
                                      }, 1400);
                                    } catch {
                                      setCopiedEmbedLinkId(`error:${link.id}`);
                                      window.setTimeout(() => setCopiedEmbedLinkId(null), 1400);
                                    }
                                  }}
                                >
                                  {t("embed_post_action_copy_link")}
                                </button>
                                {renderEmbedCta()}
                                {embedPost.dismissible && embedPost.showCloseButton ? (
                                  <button
                                    type="button"
                                    className={`${embedActionClass} border-white/30 sm:col-span-2`}
                                    onClick={() => {
                                      if (embedPost.closeButtonEnabled) {
                                        setActiveEmbedId(null);
                                      }
                                    }}
                                    disabled={!embedPost.closeButtonEnabled}
                                  >
                                    {embedPost.closeButtonLabel || t("embed_post_action_close")}
                                  </button>
                                ) : null}
                              </div>
                              {embedPost.showCtaButton && embedPost.ctaButtonEnabled && parsedCtaHref.kind === "invalid" ? (
                                <p className="mt-2 text-[11px] text-amber-300">{t("embed_post_validation_cta_invalid")}</p>
                              ) : null}
                              <p className="mt-2 text-[11px] text-zinc-300">
                                {copiedEmbedLinkId === link.id
                                  ? t("sidebar_copied")
                                  : copiedEmbedLinkId === `error:${link.id}`
                                    ? t("embed_post_toast_copy_failed")
                                    : null}
                              </p>
                            </>
                          )}
                          {isXProvider && embedPost.showCtaButton && embedPost.ctaButtonEnabled && parsedCtaHref.kind === "invalid" ? (
                            <p className="mt-2 text-[11px] text-amber-300">{t("embed_post_validation_cta_invalid")}</p>
                          ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (isExternalForm) {
                const formTitle = externalForm.title || link.title;
                const formDescription = externalForm.description || link.description || "";
                const formUrlParsed = parsePreviewHref(externalForm.formUrl ?? link.url);
                const openMode = externalForm.openMode ?? "new_tab";
                const ctaLabel = externalForm.ctaLabel?.trim() || t("external_form_open");
                const closeLabel = externalForm.closeLabel?.trim() || t("embed_post_action_close");
                const hasEmbedHtml = Boolean((externalForm.embedHtml ?? "").trim());
                const showOpenInBrowserButton = Boolean(externalForm.showOpenInBrowserButton);
                const canOpenFormUrl = Boolean(formUrlParsed.href && formUrlParsed.kind !== "invalid");
                const externalFormContent = renderStyledButtonContent({
                  title: formTitle,
                  description: formDescription || ctaLabel,
                  panelText:
                    displaySettings.textPanelContent ||
                    `${formTitle || ""}${formDescription ? `\n${formDescription}` : ""}`,
                });
                const openFormUrl = () => {
                  if (!canOpenFormUrl || !formUrlParsed.href) {
                    return;
                  }
                  onPublicLinkClick?.(link.id, "cta");
                  if (formUrlParsed.kind === "internal") {
                    window.location.assign(formUrlParsed.href);
                    return;
                  }
                  if (isWebExternalHref(formUrlParsed)) {
                    if (link.settings.openInNewTab ?? true) {
                      window.open(formUrlParsed.href, "_blank", "noopener,noreferrer");
                    } else {
                      window.location.assign(formUrlParsed.href);
                    }
                    return;
                  }
                  window.location.assign(formUrlParsed.href);
                };
                const showInlineEmbed = !externalFormInlineClosedByLink[link.id];
                const embedFailed = externalFormEmbedFailedByLink[link.id] === true;
                const shouldUseEmbedHtml = hasEmbedHtml && !embedFailed;
                const canFallbackToUrlIframe = canOpenFormUrl && Boolean(formUrlParsed.href);

                if (openMode === "embed") {
                  return (
                    <div key={link.id} className="space-y-2 rounded-2xl border border-white/20 bg-black/20 p-3 sm:p-4">
                      <div className="rounded-xl border border-white/15 bg-black/20 p-3">{externalFormContent}</div>
                      {showInlineEmbed ? (
                        <div className="overflow-hidden rounded-xl border border-white/15 bg-black/25">
                          {shouldUseEmbedHtml ? (
                            <iframe
                              title={formTitle || "External form"}
                              className="h-[560px] w-full border-0 bg-white"
                              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                              srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0">${externalForm.embedHtml ?? ""}</body></html>`}
                              onError={() =>
                                setExternalFormEmbedFailedByLink((current) => ({ ...current, [link.id]: true }))
                              }
                            />
                          ) : canFallbackToUrlIframe ? (
                            <iframe
                              title={formTitle || "External form"}
                              className="h-[560px] w-full border-0 bg-white"
                              src={formUrlParsed.href ?? undefined}
                              onError={() =>
                                setExternalFormEmbedFailedByLink((current) => ({ ...current, [link.id]: true }))
                              }
                            />
                          ) : (
                            <div className="flex h-[220px] items-center justify-center px-4 text-center text-sm text-zinc-300">
                              {t("external_form_embed_unavailable")}
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-2 border-t border-white/15 p-3 sm:grid-cols-3">
                            <button
                              type="button"
                              className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold"
                              onClick={openFormUrl}
                              disabled={!canOpenFormUrl}
                            >
                              {ctaLabel}
                            </button>
                            {showOpenInBrowserButton ? (
                              <button
                                type="button"
                                className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold"
                                onClick={openFormUrl}
                                disabled={!canOpenFormUrl}
                              >
                                {t("external_form_open_in_browser")}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="inline-flex w-full items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold"
                              onClick={() =>
                                setExternalFormInlineClosedByLink((current) => ({ ...current, [link.id]: true }))
                              }
                            >
                              {closeLabel}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {!showInlineEmbed ? (
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold"
                          onClick={() =>
                            setExternalFormInlineClosedByLink((current) => ({ ...current, [link.id]: false }))
                          }
                        >
                          {ctaLabel}
                        </button>
                      ) : null}
                    </div>
                  );
                }

                if (openMode === "modal") {
                  return (
                    <div key={link.id}>
                      <button
                        type="button"
                        className={className}
                        style={style}
                        onClick={() => {
                          if (hasEmbedHtml && !embedFailed) {
                            setActiveExternalFormId(link.id);
                            setActiveDiscountId(null);
                            setActiveEmbedId(null);
                            setActiveFormId(null);
                            setActivePromoModal(null);
                            setActivePreOpenKey(null);
                            onPublicLinkClick?.(link.id, "modal_open");
                            return;
                          }
                          openFormUrl();
                        }}
                      >
                        {externalFormContent}
                      </button>
                      {activeExternalFormId === link.id && hasEmbedHtml && !embedFailed ? (
                        <div
                          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
                          onClick={() => setActiveExternalFormId(null)}
                        >
                          <div
                            className="mx-auto flex max-h-[88dvh] w-[calc(100%-16px)] max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:w-[calc(100%-24px)] sm:p-5 md:p-6"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <h3 className="text-base font-bold leading-tight sm:text-xl md:text-2xl">
                                {formTitle}
                              </h3>
                              <button
                                type="button"
                                className="rounded-md border border-white/25 p-1"
                                onClick={() => setActiveExternalFormId(null)}
                                aria-label={t("embed_post_action_close")}
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                            {formDescription ? (
                              <p className="mb-3 text-sm text-zinc-200 sm:text-base">{formDescription}</p>
                            ) : null}
                            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/15 bg-black/25">
                              <iframe
                                title={formTitle || "External form"}
                                className="h-[560px] w-full border-0 bg-white"
                                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                                srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0">${externalForm.embedHtml ?? ""}</body></html>`}
                                onError={() =>
                                  setExternalFormEmbedFailedByLink((current) => ({ ...current, [link.id]: true }))
                                }
                              />
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <button
                                type="button"
                                className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold"
                                onClick={openFormUrl}
                                disabled={!canOpenFormUrl}
                              >
                                {ctaLabel}
                              </button>
                              {showOpenInBrowserButton ? (
                                <button
                                  type="button"
                                  className="inline-flex w-full items-center justify-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold"
                                  onClick={openFormUrl}
                                  disabled={!canOpenFormUrl}
                                >
                                  {t("external_form_open_in_browser")}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="inline-flex w-full items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold"
                                onClick={() => setActiveExternalFormId(null)}
                              >
                                {closeLabel}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (!canOpenFormUrl || !formUrlParsed.href) {
                  return (
                    <div key={link.id} aria-disabled="true" className={cn(className, "cursor-not-allowed opacity-65")} style={style}>
                      {externalFormContent}
                    </div>
                  );
                }

                if (formUrlParsed.kind === "internal") {
                  return (
                    <Link
                      key={link.id}
                      href={formUrlParsed.href}
                      className={className}
                      style={style}
                      onClick={() => onPublicLinkClick?.(link.id, "cta")}
                    >
                      {externalFormContent}
                    </Link>
                  );
                }

                return (
                  <a
                    key={link.id}
                    href={formUrlParsed.href}
                    {...getExternalAnchorTargetProps(formUrlParsed, link.settings.openInNewTab ?? true)}
                    className={className}
                    style={style}
                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                  >
                    {externalFormContent}
                  </a>
                );
              }

              if (isPromoGallery) {
                const promoItems = (promoGallery.items ?? []).filter((item) => item.active !== false);
                const safeIndex = Math.min(
                  Math.max(promoCarouselIndexByLink[link.id] ?? 0, 0),
                  Math.max(promoItems.length - 1, 0),
                );
                const slideTo = (nextIndex: number) => {
                  const container = promoCarouselRefs.current[link.id];
                  if (!container || promoItems.length === 0) {
                    return;
                  }
                  const clamped = Math.min(Math.max(nextIndex, 0), promoItems.length - 1);
                  const child = container.children.item(clamped) as HTMLElement | null;
                  if (!child) {
                    return;
                  }
                  container.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
                  setPromoCarouselIndexByLink((current) => ({ ...current, [link.id]: clamped }));
                };

                return (
                  <div key={link.id} className="space-y-3 rounded-2xl border border-white/20 bg-black/20 p-3 sm:p-4">
                    {(promoGallery.title || promoGallery.description) ? (
                      <div className="space-y-1 px-1">
                        {promoGallery.title ? (
                          <p className="text-sm font-semibold sm:text-base">{promoGallery.title}</p>
                        ) : null}
                        {promoGallery.description ? (
                          <p className="text-xs text-zinc-300 sm:text-sm">{promoGallery.description}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {promoItems.length === 0 ? (
                      isAdminPreview ? (
                        <div className="rounded-xl border border-dashed border-white/20 px-3 py-6 text-center text-xs text-zinc-300">
                          {t("promo_gallery_items_empty")}
                        </div>
                      ) : null
                    ) : (
                      <>
                        <div
                          ref={(node) => {
                            promoCarouselRefs.current[link.id] = node;
                          }}
                          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
                          onScroll={(event) => {
                            const target = event.currentTarget;
                            const child = target.children.item(0) as HTMLElement | null;
                            if (!child || child.clientWidth <= 0) {
                              return;
                            }
                            const nextIndex = Math.round(target.scrollLeft / (child.clientWidth + 12));
                            setPromoCarouselIndexByLink((current) => ({
                              ...current,
                              [link.id]: Math.min(Math.max(nextIndex, 0), promoItems.length - 1),
                            }));
                          }}
                        >
                          {promoItems.map((item, index) => (
                            <button
                              key={item.id || `promo-item-${index}`}
                              type="button"
                              className="w-[84%] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/20 bg-zinc-900/75 text-left"
                              onClick={() => setActivePromoModal({ linkId: link.id, index })}
                            >
                              <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-800/80">
                                {item.imageUrl ? (
                                  <SafeImage
                                    src={item.imageUrl}
                                    alt={item.title || ""}
                                    width={1200}
                                    height={900}
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="space-y-1 p-3">
                                {item.badge ? (
                                  <span className="inline-flex rounded-full border border-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                    {item.badge}
                                  </span>
                                ) : null}
                                {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
                                {item.description ? (
                                  <p className="line-clamp-2 text-xs text-zinc-300">{item.description}</p>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-white/25 px-3 py-1 text-xs disabled:opacity-40"
                            disabled={safeIndex <= 0}
                            onClick={() => slideTo(safeIndex - 1)}
                          >
                            {t("promo_gallery_prev")}
                          </button>
                          <div className="flex items-center gap-1">
                            {promoItems.map((item, index) => (
                              <button
                                key={`dot-${item.id || index}`}
                                type="button"
                                aria-label={`promo-${index + 1}`}
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full border border-white/40",
                                  index === safeIndex ? "bg-white" : "bg-transparent",
                                )}
                                onClick={() => slideTo(index)}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            className="rounded-full border border-white/25 px-3 py-1 text-xs disabled:opacity-40"
                            disabled={safeIndex >= promoItems.length - 1}
                            onClick={() => slideTo(safeIndex + 1)}
                          >
                            {t("promo_gallery_next")}
                          </button>
                        </div>
                      </>
                    )}

                    {activePromoModal?.linkId === link.id && promoItems[activePromoModal.index] ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
                        onClick={() => setActivePromoModal(null)}
                      >
                        <div
                          className="mx-auto flex max-h-[88dvh] w-[calc(100%-16px)] max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:w-[calc(100%-24px)] sm:p-5 md:p-6"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {(() => {
                            const modalItem = promoItems[activePromoModal.index];
                            const modalCta = parsePreviewHref(modalItem.ctaUrl ?? "");
                            const conditionRows = (modalItem.conditions ?? []).filter(
                              (row) => (row.label ?? "").trim() || (row.value ?? "").trim(),
                            );
                            return (
                              <>
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <h3 className="text-base font-bold leading-tight sm:text-xl md:text-2xl">
                                    {modalItem.title || promoGallery.title || ""}
                                  </h3>
                                  <button
                                    type="button"
                                    className="rounded-md border border-white/25 p-1"
                                    onClick={() => setActivePromoModal(null)}
                                    aria-label={t("embed_post_action_close")}
                                  >
                                    <X className="size-4" />
                                  </button>
                                </div>
                                <div className="min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                                  {modalItem.imageUrl ? (
                                    <div className="w-full overflow-hidden rounded-2xl border border-white/20 bg-zinc-800/80">
                                      <div className="aspect-[4/3] w-full">
                                        <SafeImage
                                          src={modalItem.imageUrl}
                                          alt={modalItem.title || ""}
                                          width={1200}
                                          height={900}
                                          className="h-full w-full object-cover"
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                  {modalItem.title ? (
                                    <p className="mt-3 text-base font-semibold sm:text-lg">{modalItem.title}</p>
                                  ) : null}
                                  {modalItem.description ? (
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200 sm:text-base">
                                      {modalItem.description}
                                    </p>
                                  ) : null}
                                  {conditionRows.length > 0 ? (
                                    <div className="mt-3 overflow-hidden rounded-xl border border-white/20">
                                      <table className="w-full text-left text-xs sm:text-sm">
                                        <tbody>
                                          {conditionRows.map((row, rowIndex) => (
                                            <tr key={row.id || `condition-row-${rowIndex}`} className="border-b border-white/10 last:border-b-0">
                                              <td className="w-[45%] bg-white/5 px-3 py-2 text-zinc-300">{row.label}</td>
                                              <td className="px-3 py-2">{row.value}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : null}
                                  {modalItem.ctaLabel && modalCta.href && modalCta.kind !== "invalid" ? (
                                    modalCta.kind === "internal" ? (
                                      <Link
                                        href={modalCta.href}
                                        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/30 px-5 py-3 text-sm font-semibold sm:text-base"
                                        onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                      >
                                        {modalItem.ctaLabel}
                                      </Link>
                                    ) : (
                                      <a
                                        href={modalCta.href}
                                        {...getExternalAnchorTargetProps(modalCta, modalItem.openInNewTab ?? true)}
                                        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/30 px-5 py-3 text-sm font-semibold sm:text-base"
                                        onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                      >
                                        {modalItem.ctaLabel}
                                      </a>
                                    )
                                  ) : null}
                                  <div className="mt-4 grid grid-cols-3 gap-2">
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/25 px-3 py-2 text-xs disabled:opacity-40"
                                      disabled={activePromoModal.index <= 0}
                                      onClick={() =>
                                        setActivePromoModal((current) =>
                                          current
                                            ? { ...current, index: Math.max(current.index - 1, 0) }
                                            : current,
                                        )
                                      }
                                    >
                                      {t("promo_gallery_prev")}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/25 px-3 py-2 text-xs"
                                      onClick={() => setActivePromoModal(null)}
                                    >
                                      {t("embed_post_action_close")}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/25 px-3 py-2 text-xs disabled:opacity-40"
                                      disabled={activePromoModal.index >= promoItems.length - 1}
                                      onClick={() =>
                                        setActivePromoModal((current) =>
                                          current
                                            ? {
                                                ...current,
                                                index: Math.min(current.index + 1, promoItems.length - 1),
                                              }
                                            : current,
                                        )
                                      }
                                    >
                                      {t("promo_gallery_next")}
                                    </button>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (isForm) {
                const currentFormValues = formValuesByLink[link.id] ?? {};
                const currentFormErrors = formErrorsByLink[link.id] ?? {};
                const currentFormFiles = formFilesByLink[link.id] ?? {};
                const isSubmitted = Boolean(formSubmittedByLink[link.id]);
                const isSubmitting = Boolean(formSubmittingByLink[link.id]);
                const submitError = formSubmitErrorByLink[link.id] ?? "";
                const supportTemplate = isSupportTemplate(form.template) ? form.template : null;
                const clearLinkFormFiles = (targetLinkId: string) => {
                  setFormFilesByLink((current) => {
                    const existing = current[targetLinkId];
                    if (!existing) {
                      return current;
                    }
                    Object.values(existing).forEach((selection) => {
                      URL.revokeObjectURL(selection.previewUrl);
                    });
                    const next = { ...current };
                    delete next[targetLinkId];
                    return next;
                  });
                };
                const closeFormModal = () => {
                  clearLinkFormFiles(link.id);
                  setActiveFormId(null);
                };
                const handleFieldFocus = (event: FocusEvent<HTMLElement>) => {
                  event.currentTarget.scrollIntoView({
                    block: "center",
                    inline: "nearest",
                    behavior: "smooth",
                  });
                };
                const clearFieldError = (fieldId: string) => {
                  setFormErrorsByLink((current) => ({
                    ...current,
                    [link.id]: {
                      ...(current[link.id] ?? {}),
                      [fieldId]: "",
                    },
                  }));
                };
                const setStringFieldValue = (fieldId: string, value: string) => {
                  setFormValuesByLink((current) => ({
                    ...current,
                    [link.id]: {
                      ...(current[link.id] ?? {}),
                      [fieldId]: value,
                    },
                  }));
                  clearFieldError(fieldId);
                };
                const validateForm = (): FormSubmissionErrors => {
                  const nextErrors: FormSubmissionErrors = {};
                  form.fields.forEach((field) => {
                    if (isImageUploadFieldType(field.type)) {
                      const fileSelection = currentFormFiles[field.id];
                      if (field.required && !fileSelection) {
                        nextErrors[field.id] = t("form_error_required");
                        return;
                      }
                      if (!fileSelection) {
                        return;
                      }
                      if (!fileSelection.file.type.startsWith("image/")) {
                        nextErrors[field.id] = t("form_error_image_type");
                        return;
                      }
                      if (fileSelection.file.size > MAX_SUPPORT_SLIP_SIZE_BYTES) {
                        nextErrors[field.id] = t("form_error_image_size");
                        return;
                      }
                      return;
                    }
                    const rawValue = currentFormValues[field.id];
                    const stringValue = typeof rawValue === "string" ? rawValue.trim() : "";
                    const listValue = Array.isArray(rawValue) ? rawValue.filter(Boolean) : [];
                    const hasValue = Array.isArray(rawValue) ? listValue.length > 0 : Boolean(stringValue);

                    if (field.required && !hasValue) {
                      nextErrors[field.id] = t("form_error_required");
                      return;
                    }
                    if (!hasValue) {
                      return;
                    }
                    if (field.type === "email" && !isEmailValid(stringValue)) {
                      nextErrors[field.id] = t("form_error_email");
                      return;
                    }
                    if (field.type === "phone" && !isPhoneValid(stringValue)) {
                      nextErrors[field.id] = t("form_error_phone");
                      return;
                    }
                    if (
                      isTimeFieldType(field.type) &&
                      !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(stringValue)
                    ) {
                      nextErrors[field.id] = t("form_error_time_invalid");
                      return;
                    }
                    if (isAmountField(field) && parseDecimalAmount(stringValue) === null) {
                      nextErrors[field.id] = t("form_error_required");
                      return;
                    }
                    if (
                      (isSingleSelectFieldType(field.type) || isMultiSelectFieldType(field.type)) &&
                      (!field.options || field.options.length === 0)
                    ) {
                      nextErrors[field.id] = t("form_error_options");
                    }
                  });
                  return nextErrors;
                };

                return (
                  <div key={link.id}>
                    <button
                      type="button"
                      className={className}
                      style={style}
                      onClick={() => {
                        const prefilledValues: FormSubmissionValues = {};
                        form.fields.forEach((field) => {
                          if (isMultiSelectFieldType(field.type)) {
                            return;
                          }
                          if (isImageUploadFieldType(field.type)) {
                            return;
                          }
                          const prefill = getPrefillValueForField(field, link.id);
                          if (prefill) {
                            prefilledValues[field.id] = prefill;
                          }
                        });
                        setActiveFormId(link.id);
                        setActiveDiscountId(null);
                        setActiveEmbedId(null);
                        setActiveExternalFormId(null);
                        setActivePromoModal(null);
                        setActivePreOpenKey(null);
                        setFormValuesByLink((current) => ({
                          ...current,
                          [link.id]: {
                            ...(current[link.id] ?? {}),
                            ...prefilledValues,
                          },
                        }));
                        clearLinkFormFiles(link.id);
                        setFormSubmittedByLink((current) => ({ ...current, [link.id]: false }));
                        setFormErrorsByLink((current) => ({ ...current, [link.id]: {} }));
                        setFormSubmitErrorByLink((current) => ({ ...current, [link.id]: "" }));
                        onPublicLinkClick?.(link.id, "modal_open");
                      }}
                    >
                      {renderStyledButtonContent({
                        title: form.formTitle || link.title,
                        description: form.intro || t("form_open_form"),
                        panelText:
                          displaySettings.textPanelContent ||
                          `${form.formTitle || link.title}\n${form.intro || ""}`,
                      })}
                    </button>

                    {activeFormId === link.id ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:p-4 sm:items-center"
                        onClick={closeFormModal}
                      >
                        <div
                          className="mx-auto flex w-[calc(100%-16px)] max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:w-[calc(100%-24px)] sm:p-5 md:p-6"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="text-lg font-bold leading-tight sm:text-xl md:text-2xl">
                              {form.formTitle || link.title}
                            </h3>
                            <button
                              type="button"
                              className="rounded-md border border-white/25 p-1"
                              onClick={closeFormModal}
                              aria-label={t("embed_post_action_close")}
                            >
                              <X className="size-4" />
                            </button>
                          </div>

                          <div className="max-h-[calc(88dvh-5.5rem)] overflow-y-auto overflow-x-hidden pr-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                            {isSubmitted ? (
                              <div className="space-y-3 rounded-xl border border-white/15 bg-black/25 p-4">
                                <p className="whitespace-pre-line text-sm leading-relaxed sm:text-base">
                                  {form.outro || t("form_submit_success_default")}
                                </p>
                                <button
                                  type="button"
                                  className="w-full min-h-12 rounded-md border border-white/30 px-3 py-2 text-sm font-semibold"
                                  onClick={closeFormModal}
                                >
                                  {t("embed_post_action_close")}
                                </button>
                              </div>
                            ) : (
                              <form
                                className="space-y-3"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  if (isSubmitting) {
                                    return;
                                  }
                                  const nextErrors = validateForm();
                                  setFormErrorsByLink((current) => ({ ...current, [link.id]: nextErrors }));
                                  if (Object.keys(nextErrors).length > 0) {
                                    return;
                                  }
                                  const responses = form.fields.map((field) => {
                                    const raw = currentFormValues[field.id];
                                    if (isMultiSelectFieldType(field.type)) {
                                      return {
                                        id: field.id,
                                        label: field.label,
                                        value: Array.isArray(raw) ? raw : [],
                                      };
                                    }
                                    if (isImageUploadFieldType(field.type)) {
                                      const fileSelection = currentFormFiles[field.id];
                                      return {
                                        id: field.id,
                                        label: field.label,
                                        value: fileSelection?.fileName ?? "",
                                      };
                                    }
                                    return {
                                        id: field.id,
                                        label: field.label,
                                        value:
                                        isTimeFieldType(field.type) && typeof raw === "string"
                                          ? normalizeTimeInputValue(raw)
                                          : typeof raw === "string"
                                            ? raw
                                            : "",
                                    };
                                  });

                                  if (!supportTemplate) {
                                    setFormSubmittingByLink((current) => ({ ...current, [link.id]: true }));
                                    setFormSubmitErrorByLink((current) => ({ ...current, [link.id]: "" }));
                                    const submitGeneric = async () => {
                                      try {
                                        const response = await fetch("/api/forms/generic-submissions", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            submitted_at: new Date().toISOString(),
                                            slug: targetRouteSlug,
                                            form_title: form.formTitle || link.title,
                                            form_id: link.id,
                                            responses,
                                          }),
                                        });
                                        if (!response.ok) {
                                          const body = (await response.json().catch(() => null)) as
                                            | { error?: string }
                                            | null;
                                          throw new Error(body?.error || t("form_submit_failed"));
                                        }
                                        setFormSubmittedByLink((current) => ({ ...current, [link.id]: true }));
                                      } catch (error) {
                                        const message =
                                          error instanceof Error && error.message
                                            ? error.message
                                            : t("form_submit_failed");
                                        setFormSubmitErrorByLink((current) => ({
                                          ...current,
                                          [link.id]: message,
                                        }));
                                      } finally {
                                        setFormSubmittingByLink((current) => ({
                                          ...current,
                                          [link.id]: false,
                                        }));
                                      }
                                    };
                                    void submitGeneric();
                                    return;
                                  }

                                  setFormSubmittingByLink((current) => ({ ...current, [link.id]: true }));
                                  setFormSubmitErrorByLink((current) => ({ ...current, [link.id]: "" }));

                                  const submitSupport = async () => {
                                    try {
                                      const getSupportValue = (tokens: string[]): string => {
                                        const matched = responses.find((entry) => {
                                          const id = entry.id.trim().toLowerCase();
                                          const label = getFieldLabelTokens(entry.label);
                                          return tokens.some((token) => id.includes(token) || label.includes(token));
                                        });
                                        if (!matched || typeof matched.value !== "string") {
                                          return "";
                                        }
                                        return matched.value.trim();
                                      };
                                      const bankName = getSupportValue(["bank_name", "bankname", "ธนาคาร"]);
                                      const accountNumber = getSupportValue([
                                        "account_number",
                                        "accountnumber",
                                        "เลขที่บัญชี",
                                      ]);
                                      const amountRaw = getSupportValue(["amount", "ยอดเงิน"]);
                                      const parsedAmount = parseDecimalAmount(amountRaw);
                                      const amount =
                                        parsedAmount === null ? amountRaw : parsedAmount.toFixed(2);
                                      const responsesJson = JSON.stringify(responses);
                                      const supportResponseFieldKeys = new Set([
                                        "username",
                                        "registeredPhone",
                                        "fullName",
                                        "transactionTime",
                                        "note",
                                        "bankName",
                                        "accountNumber",
                                        "amount",
                                        "slip",
                                      ]);
                                      const extraFields = responses.reduce<Record<string, string | string[]>>(
                                        (accumulator, entry) => {
                                          const fieldName = getSupportFieldName(
                                            { type: "text", label: entry.label },
                                            supportTemplate,
                                          );
                                          if (!fieldName || !supportResponseFieldKeys.has(fieldName)) {
                                            accumulator[entry.id] = entry.value;
                                          }
                                          return accumulator;
                                        },
                                        {},
                                      );

                                      if (supportTemplate === "deposit_issue") {
                                        const slipField = form.fields.find((field) =>
                                          isImageUploadFieldType(field.type),
                                        );
                                        const slipFile = slipField ? currentFormFiles[slipField.id]?.file : null;
                                        if (!slipFile) {
                                          setFormErrorsByLink((current) => ({
                                            ...current,
                                            [link.id]: {
                                              ...(current[link.id] ?? {}),
                                              [slipField?.id ?? ""]: t("form_error_required"),
                                            },
                                          }));
                                          return;
                                        }

                                        const payload = new FormData();
                                        const getFieldValueByName = (fieldName: string): string => {
                                          const targetField = form.fields.find(
                                            (field) =>
                                              getSupportFieldName(field, supportTemplate) === fieldName,
                                          );
                                          if (!targetField) {
                                            return "";
                                          }
                                          const rawValue = currentFormValues[targetField.id];
                                          if (typeof rawValue !== "string") {
                                            return "";
                                          }
                                          if (fieldName === "transactionTime") {
                                            return normalizeTimeInputValue(rawValue);
                                          }
                                          return rawValue.trim();
                                        };
                                        payload.append("slug", targetRouteSlug);
                                        payload.append("linkId", link.id);
                                        payload.append("template", supportTemplate);
                                        payload.append("formTitle", form.formTitle || link.title);
                                        payload.append("responses", responsesJson);
                                        payload.append("responses_json", responsesJson);
                                        payload.append("extra_fields", JSON.stringify(extraFields));
                                        payload.append("bankName", bankName);
                                        payload.append("accountNumber", accountNumber);
                                        payload.append("amount", amount);
                                        payload.append(
                                          "username",
                                          getFieldValueByName("username") || targetRouteSlug,
                                        );
                                        payload.append(
                                          "registeredPhone",
                                          getFieldValueByName("registeredPhone"),
                                        );
                                        payload.append("fullName", getFieldValueByName("fullName"));
                                        payload.append(
                                          "transactionTime",
                                          getFieldValueByName("transactionTime"),
                                        );
                                        payload.append("note", getFieldValueByName("note"));
                                        payload.append("slip", slipFile);

                                        const response = await fetch("/api/support/deposit-issues", {
                                          method: "POST",
                                          body: payload,
                                        });
                                        if (!response.ok) {
                                          const body = (await response.json().catch(() => null)) as
                                            | { error?: string }
                                            | null;
                                          throw new Error(body?.error || t("form_submit_failed"));
                                        }
                                      } else {
                                        const response = await fetch("/api/support/withdraw-issues", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            slug: targetRouteSlug,
                                            linkId: link.id,
                                            template: supportTemplate,
                                            formTitle: form.formTitle || link.title,
                                            responses,
                                            responses_json: responsesJson,
                                            extra_fields: extraFields,
                                            bankName,
                                            accountNumber,
                                            amount,
                                          }),
                                        });
                                        if (!response.ok) {
                                          const body = (await response.json().catch(() => null)) as
                                            | { error?: string }
                                            | null;
                                          throw new Error(body?.error || t("form_submit_failed"));
                                        }
                                      }

                                      setFormSubmittedByLink((current) => ({ ...current, [link.id]: true }));
                                    } catch (error) {
                                      const message =
                                        error instanceof Error && error.message
                                          ? error.message
                                          : t("form_submit_failed");
                                      setFormSubmitErrorByLink((current) => ({
                                        ...current,
                                        [link.id]: message,
                                      }));
                                    } finally {
                                      setFormSubmittingByLink((current) => ({
                                        ...current,
                                        [link.id]: false,
                                      }));
                                    }
                                  };

                                  void submitSupport();
                                }}
                              >
                                {form.intro ? (
                                  <p className="text-sm leading-relaxed text-zinc-200 sm:text-base">{form.intro}</p>
                                ) : null}
                                {form.fields.map((field) => {
                                  const fieldValue = currentFormValues[field.id];
                                  const options = field.options ?? [];
                                  const supportFieldName = getSupportFieldName(field, supportTemplate);
                                  const fieldName = supportFieldName || field.id;
                                  const supportFieldLabelKey = getSupportFieldLabelKey(field);
                                  const fieldLabel =
                                    supportFieldLabelKey === "bank_name"
                                      ? t("form_support_label_bank_name")
                                      : supportFieldLabelKey === "account_number"
                                        ? t("form_support_label_account_number")
                                        : supportFieldLabelKey === "amount"
                                          ? t("form_support_label_amount")
                                          : field.label;
                                  const showOptions =
                                    isSingleSelectFieldType(field.type) ||
                                    isMultiSelectFieldType(field.type);

                                  return (
                                    <div key={field.id} className="space-y-1.5">
                                      <label className="text-sm font-medium text-zinc-200">
                                        {fieldLabel}
                                        {field.required ? " *" : ""}
                                      </label>
                                    {isTextAreaFieldType(field.type) ? (
                                      <textarea
                                        name={fieldName}
                                        className="min-h-[96px] w-full rounded-md border border-white/20 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                                          value={typeof fieldValue === "string" ? fieldValue : ""}
                                          placeholder={field.placeholder ?? ""}
                                          onFocus={handleFieldFocus}
                                          onChange={(event) => setStringFieldValue(field.id, event.target.value)}
                                        />
                                      ) : isImageUploadFieldType(field.type) ? (
                                        <div className="space-y-2">
                                          <input
                                            name={fieldName}
                                            type="file"
                                            accept="image/*"
                                            className="block min-h-11 w-full rounded-md border border-white/20 bg-black/35 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                                            onFocus={handleFieldFocus}
                                            onChange={(event) => {
                                              const selected = event.target.files?.[0];
                                              if (!selected) {
                                                return;
                                              }
                                              if (!selected.type.startsWith("image/")) {
                                                setFormErrorsByLink((current) => ({
                                                  ...current,
                                                  [link.id]: {
                                                    ...(current[link.id] ?? {}),
                                                    [field.id]: t("form_error_image_type"),
                                                  },
                                                }));
                                                event.target.value = "";
                                                return;
                                              }
                                              if (selected.size > MAX_SUPPORT_SLIP_SIZE_BYTES) {
                                                setFormErrorsByLink((current) => ({
                                                  ...current,
                                                  [link.id]: {
                                                    ...(current[link.id] ?? {}),
                                                    [field.id]: t("form_error_image_size"),
                                                  },
                                                }));
                                                event.target.value = "";
                                                return;
                                              }

                                              setFormFilesByLink((current) => {
                                                const previous = current[link.id]?.[field.id];
                                                if (previous?.previewUrl) {
                                                  URL.revokeObjectURL(previous.previewUrl);
                                                }
                                                const previewUrl = URL.createObjectURL(selected);
                                                return {
                                                  ...current,
                                                  [link.id]: {
                                                    ...(current[link.id] ?? {}),
                                                    [field.id]: {
                                                      file: selected,
                                                      previewUrl,
                                                      fileName: selected.name,
                                                    },
                                                  },
                                                };
                                              });
                                              setFormErrorsByLink((current) => ({
                                                ...current,
                                                [link.id]: {
                                                  ...(current[link.id] ?? {}),
                                                  [field.id]: "",
                                                },
                                              }));
                                              event.target.value = "";
                                            }}
                                          />
                                          {currentFormFiles[field.id] ? (
                                            <div className="space-y-2 overflow-hidden rounded-lg border border-white/20 p-2">
                                              <SafeImage
                                                src={currentFormFiles[field.id].previewUrl}
                                                alt={currentFormFiles[field.id].fileName}
                                                className="max-h-48 w-full rounded-md object-contain"
                                                width={640}
                                                height={360}
                                                unoptimized
                                              />
                                              <p className="break-all text-xs text-zinc-300">
                                                {currentFormFiles[field.id].fileName}
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : isSingleSelectFieldType(field.type) && showOptions ? (
                                        <div className="space-y-2">
                                          {options.map((option) => (
                                            <label key={option} className="flex items-center gap-2 text-sm">
                                              <input
                                                type="radio"
                                                name={fieldName}
                                                checked={fieldValue === option}
                                                onFocus={handleFieldFocus}
                                                onChange={() => setStringFieldValue(field.id, option)}
                                              />
                                              <span>{option}</span>
                                            </label>
                                          ))}
                                        </div>
                                      ) : isMultiSelectFieldType(field.type) && showOptions ? (
                                        <div className="space-y-2">
                                          {options.map((option) => {
                                            const currentValues = Array.isArray(fieldValue) ? fieldValue : [];
                                            const checked = currentValues.includes(option);
                                            return (
                                              <label key={option} className="flex items-center gap-2 text-sm">
                                                <input
                                                  type="checkbox"
                                                  name={`${fieldName}[]`}
                                                  checked={checked}
                                                  onFocus={handleFieldFocus}
                                                  onChange={(event) => {
                                                    const nextValues = event.target.checked
                                                      ? [...currentValues, option]
                                                      : currentValues.filter((item) => item !== option);
                                                    setFormValuesByLink((current) => ({
                                                      ...current,
                                                      [link.id]: {
                                                        ...(current[link.id] ?? {}),
                                                        [field.id]: nextValues,
                                                      },
                                                    }));
                                                    clearFieldError(field.id);
                                                  }}
                                                />
                                                <span>{option}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      ) : isSingleSelectFieldType(field.type) && showOptions ? (
                                        <select
                                          name={fieldName}
                                          className="h-11 w-full rounded-md border border-white/20 bg-black/35 px-3 text-sm text-white"
                                          value={typeof fieldValue === "string" ? fieldValue : ""}
                                          onFocus={handleFieldFocus}
                                          onChange={(event) => setStringFieldValue(field.id, event.target.value)}
                                        >
                                          <option value="">{t("form_select_option")}</option>
                                          {options.map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      ) : isTimeFieldType(field.type) ? (
                                        <div className="grid grid-cols-3 gap-2">
                                          {(["hour", "minute", "second"] as const).map((segment) => {
                                            const current = getTimeParts(
                                              typeof fieldValue === "string" ? fieldValue : "",
                                            );
                                            const value = current[segment];
                                            const options =
                                              segment === "hour"
                                                ? TIME_SEGMENT_OPTIONS.slice(0, 24)
                                                : TIME_SEGMENT_OPTIONS;
                                            return (
                                              <select
                                                key={`${field.id}-${segment}`}
                                                className="h-11 w-full rounded-md border border-white/20 bg-black/35 px-3 text-sm text-white"
                                                value={value}
                                                onFocus={handleFieldFocus}
                                                onChange={(event) => {
                                                  const nextParts: TimeParts = {
                                                    ...current,
                                                    [segment]: event.target.value,
                                                  };
                                                  setFormValuesByLink((currentValues) => ({
                                                    ...currentValues,
                                                    [link.id]: {
                                                      ...(currentValues[link.id] ?? {}),
                                                      [field.id]: buildTimeFromParts(nextParts),
                                                    },
                                                  }));
                                                }}
                                              >
                                                <option value="">{segment === "hour" ? "HH" : segment === "minute" ? "MM" : "SS"}</option>
                                                {options.map((option) => (
                                                  <option key={option} value={option}>
                                                    {option}
                                                  </option>
                                                ))}
                                              </select>
                                            );
                                          })}
                                        </div>
                                      ) : isAmountField(field) ? (
                                        <div className="relative">
                                          <input
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            className="h-11 w-full rounded-md border border-white/20 bg-black/35 px-3 pr-14 text-sm text-white outline-none"
                                            value={typeof fieldValue === "string" ? fieldValue : ""}
                                            placeholder={t("form_support_amount_placeholder")}
                                            onFocus={handleFieldFocus}
                                            onChange={(event) => {
                                              const nextAmount = sanitizeAmountInput(event.target.value);
                                              setFormValuesByLink((current) => ({
                                                ...current,
                                                [link.id]: {
                                                  ...(current[link.id] ?? {}),
                                                  [field.id]: nextAmount,
                                                },
                                              }));
                                            }}
                                            onBlur={() => {
                                              const rawValue = typeof fieldValue === "string" ? fieldValue : "";
                                              const parsed = parseDecimalAmount(rawValue);
                                              if (parsed === null) {
                                                return;
                                              }
                                              setFormValuesByLink((current) => ({
                                                ...current,
                                                [link.id]: {
                                                  ...(current[link.id] ?? {}),
                                                  [field.id]: parsed.toFixed(2),
                                                },
                                              }));
                                            }}
                                          />
                                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-300">
                                            {t("form_support_amount_suffix")}
                                          </span>
                                        </div>
                                      ) : (
                                        <input
                                          name={fieldName}
                                          type={
                                            field.type === "email"
                                              ? "email"
                                              : field.type === "phone"
                                                ? "tel"
                                                : field.type === "date" || field.type === "date_of_birth"
                                                  ? "date"
                                                  : "text"
                                          }
                                          className="h-11 w-full rounded-md border border-white/20 bg-black/35 px-3 text-sm text-white outline-none"
                                          value={typeof fieldValue === "string" ? fieldValue : ""}
                                          placeholder={field.placeholder ?? ""}
                                          onFocus={handleFieldFocus}
                                          onChange={(event) => setStringFieldValue(field.id, event.target.value)}
                                        />
                                      )}
                                      {currentFormErrors[field.id] ? (
                                        <p className="text-xs text-amber-300">{currentFormErrors[field.id]}</p>
                                      ) : null}
                                    </div>
                                  );
                                })}
                                {form.termsPlaceholder ? (
                                  <p className="text-xs leading-relaxed text-zinc-300">{form.termsPlaceholder}</p>
                                ) : null}
                                {submitError ? (
                                  <p className="text-xs text-amber-300">{submitError}</p>
                                ) : null}
                                <div className="sticky bottom-0 -mx-1 bg-zinc-950/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <button
                                      type="submit"
                                      disabled={isSubmitting}
                                      className="w-full min-h-12 rounded-full border border-white/30 px-5 text-sm font-semibold sm:text-base disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isSubmitting
                                        ? t("form_submit_submitting")
                                        : submitError
                                          ? t("form_submit_retry")
                                          : form.submitLabel || t("form_submit")}
                                    </button>
                                    <button
                                      type="button"
                                      className="w-full min-h-12 rounded-full border border-white/20 px-5 text-sm font-semibold sm:text-base"
                                      onClick={closeFormModal}
                                      disabled={isSubmitting}
                                    >
                                      {form.cancelLabel || t("form_submit_cancel")}
                                    </button>
                                  </div>
                                </div>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (parsedHref.kind === "invalid" || !parsedHref.href) {
                return (
                  <div
                    key={link.id}
                    aria-disabled="true"
                    className={cn(className, "cursor-not-allowed opacity-65 hover:brightness-100")}
                    style={style}
                  >
                    {content}
                  </div>
                );
              }

              const preOpenEnabled = mode === "public" && Boolean(link.preOpenModal?.enabled);

              if (preOpenEnabled) {
                const preOpenKey = `link:${link.id}`;
                const noticeTitle = link.preOpenModal?.title?.trim() || "Notice";
                const noticeBody = link.preOpenModal?.description?.trim() || "";
                const confirmLabel = link.preOpenModal?.primaryButtonLabel?.trim() || "Continue";
                const secondaryLabel = link.preOpenModal?.secondaryButtonLabel?.trim() || t("form_submit_cancel");
                const destinationOverride = parsePreviewHref(link.preOpenModal?.destinationUrl?.trim() || "");
                const useDestinationOverride =
                  destinationOverride.kind !== "invalid" && Boolean(destinationOverride.href);
                const dismissible = link.preOpenModal?.dismissible ?? true;
                const showSecondaryButton = link.preOpenModal?.showSecondaryButton ?? true;
                const buttonStyle =
                  link.preOpenModal?.buttonStyle === "outline"
                    ? "border-white/50 bg-transparent"
                    : link.preOpenModal?.buttonStyle === "glow"
                      ? "border-emerald-300/60 bg-emerald-500/30 shadow-[0_0_22px_rgba(16,185,129,0.35)]"
                      : "border-white/30 bg-white/10";
                const bannerSrc = normalizeImageSrc(link.preOpenModal?.bannerImageUrl);
                const continueWithTarget = (target: PreviewHrefResult) => {
                  if (!target.href) {
                    return;
                  }
                  onPublicLinkClick?.(link.id, "cta");
                  if (target.kind === "internal") {
                    window.location.assign(target.href);
                    return;
                  }
                  if (isWebExternalHref(target)) {
                    if (openInNewTab) {
                      window.open(target.href, "_blank", "noopener,noreferrer");
                    } else {
                      window.location.assign(target.href);
                    }
                    return;
                  }
                  window.location.assign(target.href);
                };
                const continueWithDefaultAction = () => {
                  if (isDiscount) {
                    setActiveDiscountId(link.id);
                    setActiveEmbedId(null);
                    setActiveFormId(null);
                    setActiveExternalFormId(null);
                    if (discount.analyticsHooks?.trackModalOpen ?? true) {
                      onPublicLinkClick?.(link.id, "modal_open");
                    }
                    return;
                  }
                  if (isEmbedPost) {
                    setActiveEmbedId(link.id);
                    setActiveDiscountId(null);
                    setActiveFormId(null);
                    setActiveExternalFormId(null);
                    onPublicLinkClick?.(link.id, "modal_open");
                    return;
                  }
                  if (isForm) {
                    const prefilledValues: FormSubmissionValues = {};
                    form.fields.forEach((field) => {
                      if (isMultiSelectFieldType(field.type) || isImageUploadFieldType(field.type)) {
                        return;
                      }
                      const prefill = getPrefillValueForField(field, link.id);
                      if (prefill) {
                        prefilledValues[field.id] = prefill;
                      }
                    });
                    setActiveFormId(link.id);
                    setActiveDiscountId(null);
                    setActiveEmbedId(null);
                    setActiveExternalFormId(null);
                    setActivePromoModal(null);
                    setFormValuesByLink((current) => ({
                      ...current,
                      [link.id]: {
                        ...(current[link.id] ?? {}),
                        ...prefilledValues,
                      },
                    }));
                    setFormFilesByLink((current) => {
                      const existing = current[link.id];
                      if (!existing) {
                        return current;
                      }
                      Object.values(existing).forEach((selection) => {
                        URL.revokeObjectURL(selection.previewUrl);
                      });
                      const next = { ...current };
                      delete next[link.id];
                      return next;
                    });
                    setFormSubmittedByLink((current) => ({ ...current, [link.id]: false }));
                    setFormErrorsByLink((current) => ({ ...current, [link.id]: {} }));
                    setFormSubmitErrorByLink((current) => ({ ...current, [link.id]: "" }));
                    onPublicLinkClick?.(link.id, "modal_open");
                    return;
                  }
                  if (isExternalForm) {
                    const formUrlParsed = parsePreviewHref(externalForm.formUrl ?? link.url);
                    const openMode = externalForm.openMode ?? "new_tab";
                    const hasEmbedHtml = Boolean((externalForm.embedHtml ?? "").trim());
                    if (openMode === "modal" && hasEmbedHtml) {
                      setActiveExternalFormId(link.id);
                      setActiveDiscountId(null);
                      setActiveEmbedId(null);
                      setActiveFormId(null);
                      setActivePromoModal(null);
                      onPublicLinkClick?.(link.id, "modal_open");
                      return;
                    }
                    continueWithTarget(formUrlParsed);
                    return;
                  }
                  if (isPromoGallery) {
                    const items = (promoGallery.items ?? []).filter((item) => item.active !== false);
                    if (items.length > 0) {
                      setActivePromoModal({ linkId: link.id, index: 0 });
                      setActiveDiscountId(null);
                      setActiveEmbedId(null);
                      setActiveFormId(null);
                      setActiveExternalFormId(null);
                      onPublicLinkClick?.(link.id, "modal_open");
                    }
                    return;
                  }
                  continueWithTarget(parsedHref);
                };
                return (
                  <div key={link.id}>
                    <button
                      type="button"
                      className={className}
                      style={style}
                      onClick={() => setActivePreOpenKey(preOpenKey)}
                    >
                      {content}
                    </button>
                    {activePreOpenKey === preOpenKey ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4"
                        onClick={() => {
                          if (dismissible) {
                            setActivePreOpenKey(null);
                          }
                        }}
                      >
                        <div
                          className="mx-auto flex max-h-[82dvh] w-[calc(100%-16px)] max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl sm:w-[calc(100%-24px)] sm:p-5 md:p-6"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="text-base font-bold leading-tight sm:text-xl">{noticeTitle}</h3>
                            {dismissible ? (
                              <button
                                type="button"
                                className="rounded-md border border-white/25 p-1"
                                onClick={() => setActivePreOpenKey(null)}
                                aria-label={t("embed_post_action_close")}
                              >
                                <X className="size-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1">
                            {bannerSrc ? (
                              <SafeImage
                                src={bannerSrc}
                                alt=""
                                width={480}
                                height={240}
                                className="mb-3 w-full rounded-xl border border-white/20 object-cover"
                              />
                            ) : null}
                            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-200 sm:text-base">
                              {noticeBody}
                            </p>
                            <div className={cn("mt-4 grid grid-cols-1 gap-2", showSecondaryButton && "sm:grid-cols-2")}>
                              <button
                                type="button"
                                className={cn(
                                  "w-full min-h-12 rounded-full border px-5 text-sm font-semibold sm:text-base",
                                  buttonStyle,
                                )}
                                onClick={() => {
                                  setActivePreOpenKey(null);
                                  if (useDestinationOverride) {
                                    continueWithTarget(destinationOverride);
                                    return;
                                  }
                                  continueWithDefaultAction();
                                }}
                              >
                                {confirmLabel}
                              </button>
                              {showSecondaryButton ? (
                                <button
                                  type="button"
                                  className="w-full min-h-12 rounded-full border border-white/20 px-5 text-sm font-semibold sm:text-base"
                                  onClick={() => setActivePreOpenKey(null)}
                                >
                                  {secondaryLabel}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (parsedHref.kind === "internal") {
                return (
                  <Link
                    key={link.id}
                    href={parsedHref.href}
                    className={className}
                    style={style}
                    onClick={() => {
                      if (mode === "public") {
                        onPublicLinkClick?.(link.id, "cta");
                      }
                    }}
                  >
                    {content}
                  </Link>
                );
              }

              if (mode === "public") {
                return (
                  <a
                    key={link.id}
                    href={parsedHref.href}
                    {...getExternalAnchorTargetProps(parsedHref, openInNewTab)}
                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                    className={className}
                    style={style}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <a
                  key={link.id}
                  href={parsedHref.href}
                  {...getExternalAnchorTargetProps(parsedHref, openInNewTab)}
                  className={className}
                  style={style}
                >
                  {content}
                </a>
              );
            })}
            {data.text.footerEnabled ? (
              <p
                className="pt-2 text-center text-[11px]"
                style={{ color: data.theme.mutedTextColor }}
              >
                {data.text.footerText || "Footer"}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {mode === "admin" ? (
        <p className="pt-3 text-center text-xs text-muted-foreground">{t("preview_footer_admin")}</p>
      ) : null}
    </div>
  );
};
