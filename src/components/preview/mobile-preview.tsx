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

import { BuilderData, SocialLink } from "@/features/builder/types";
import { ProfileHeader } from "@/components/profile/profile-header";
import {
  getContentType,
  getDiscountData,
  getEmbedPostData,
  getFormData,
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
): { target?: "_blank"; rel?: "noreferrer" } =>
  isWebExternalHref(parsedHref) ? { target: "_blank", rel: "noreferrer" } : {};

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

const getXPostUrlFromEmbedCode = (embedCode: string): string | null => {
  const citeMatch = embedCode.match(/cite=["']([^"']+)["']/i);
  const hrefMatch = embedCode.match(/href=["']([^"']+)["']/i);
  const rawCandidate = citeMatch?.[1] || hrefMatch?.[1] || "";
  const parsed = parsePreviewHref(rawCandidate);
  if (!isWebExternalHref(parsed)) {
    return null;
  }
  try {
    const url = new URL(parsed.href);
    const isXHost = url.hostname.includes("x.com") || url.hostname.includes("twitter.com");
    const hasStatusPath = /\/status\/\d+/i.test(url.pathname);
    return isXHost && hasStatusPath ? parsed.href : null;
  } catch {
    return null;
  }
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

const toHtmlTimeValue = (value: string): string => {
  const normalized = normalizeTimeInputValue(value);
  if (!normalized) {
    return "";
  }
  const match = normalized.match(/^(\d{2}:\d{2}:\d{2})$/);
  return match ? match[1] : "";
};

const getSupportFieldName = (
  field: { type: string; label: string },
  supportTemplate: "deposit_issue" | "withdraw_issue" | null,
): string | null => {
  if (!supportTemplate) {
    return null;
  }
  const label = getFieldLabelTokens(field.label);
  if (field.type === "file_image") {
    return supportTemplate === "deposit_issue" ? "slip" : null;
  }
  if (field.type === "time_hms") {
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
    if (field.type === "time_hms") {
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
    if (!activeDiscountId && !activeEmbedId && !activeFormId && !activePreOpenKey) {
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
        setActivePreOpenKey(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeDiscountId, activeEmbedDismissible, activeEmbedId, activeFormId, activePreOpenKey]);

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

          <div className="mt-4 flex justify-center gap-3">
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
              const thumbnailKey = `${link.id}::${thumbnailSrc}`;
              const safeThumbnailSrc = brokenThumbnailKeys[thumbnailKey]
                ? THUMBNAIL_FALLBACK_SRC
                : thumbnailSrc;
              const className = cn(
                "w-full flex items-center gap-3 border font-semibold backdrop-blur-sm transition hover:brightness-105",
                isAdminPreview ? "px-4 py-3 text-sm" : "p-4 text-sm sm:p-5 sm:text-base md:p-6",
                data.buttonStyle.uppercase && "uppercase tracking-wide",
                data.buttonStyle.shadow && shadowClass,
                buttonStyleClass,
              );
              const style = {
                backgroundColor:
                  data.buttonStyle.style === "outline"
                    ? "transparent"
                    : data.buttonStyle.style === "glass"
                      ? "rgba(255,255,255,0.12)"
                      : data.theme.buttonBackground,
                color: data.theme.buttonTextColor,
                borderRadius: `${data.theme.buttonRadius}px`,
                borderColor: "rgba(255,255,255,0.25)",
              } as const;
              const parsedHref = parsePreviewHref(link.url);
              const isDiscount = getContentType(link) === "discount";
              const isEmbedPost = getContentType(link) === "embed_post";
              const isForm = getContentType(link) === "form";
              const discount = getDiscountData(link);
              const embedPost = getEmbedPostData(link);
              const form = getFormData(link);
              const discountLayout = discount.layout;

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
              const content = (
                <>
                  <SafeImage
                    src={safeThumbnailSrc}
                    alt=""
                    className="size-10 rounded-md border border-black/10 object-cover"
                    width={40}
                    height={40}
                    onError={() => {
                      if (safeThumbnailSrc === THUMBNAIL_FALLBACK_SRC || brokenThumbnailKeys[thumbnailKey]) {
                        return;
                      }
                      setBrokenThumbnailKeys((current) => ({ ...current, [thumbnailKey]: true }));
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm sm:text-base font-semibold">{link.title}</p>
                    {link.description ? (
                      <p className="truncate text-xs leading-relaxed opacity-80 sm:text-sm">{link.description}</p>
                    ) : null}
                  </div>
                  {link.settings.locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/10 px-2 py-1 text-[10px]">
                      <Lock className="size-3" />
                      {link.settings.lockMessage || t("preview_locked")}
                    </span>
                  ) : null}
                </>
              );

              if (isDiscount) {
                const code = discount.discountCode ?? "";
                const isFeatured = discountLayout === "featured";
                const cardThumbnailSrc =
                  normalizeImageSrc(discount.cardThumbnail, THUMBNAIL_FALLBACK_SRC) ??
                  THUMBNAIL_FALLBACK_SRC;
                const cardThumbnailKey = `${link.id}::card::${cardThumbnailSrc}`;
                const safeCardThumbnailSrc = brokenThumbnailKeys[cardThumbnailKey]
                  ? THUMBNAIL_FALLBACK_SRC
                  : cardThumbnailSrc;
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
                      className={cn(
                        "w-full space-y-3 border text-left font-semibold backdrop-blur-sm transition hover:brightness-105",
                        isFeatured ? "rounded-2xl shadow-xl" : "",
                        isAdminPreview ? "px-4 py-3 text-sm" : "p-4 text-sm sm:p-5 sm:text-base md:p-6",
                      )}
                      style={style}
                      onClick={() => {
                        setActiveDiscountId(link.id);
                        setActiveEmbedId(null);
                        setActivePreOpenKey(null);
                        if (discount.analyticsHooks?.trackModalOpen ?? true) {
                          onPublicLinkClick?.(link.id, "modal_open");
                        }
                      }}
                    >
                      <div className={cn("flex items-center gap-3", isFeatured && "items-start")}>
                        <SafeImage
                          src={safeCardThumbnailSrc}
                          alt=""
                          className={cn(
                            "rounded-md border border-black/10 object-cover",
                            isFeatured ? "h-16 w-20" : "size-10",
                          )}
                          width={isFeatured ? 80 : 40}
                          height={isFeatured ? 64 : 40}
                          onError={() => {
                            if (
                              safeCardThumbnailSrc === THUMBNAIL_FALLBACK_SRC ||
                              brokenThumbnailKeys[cardThumbnailKey]
                            ) {
                              return;
                            }
                            setBrokenThumbnailKeys((current) => ({ ...current, [cardThumbnailKey]: true }));
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm sm:text-base font-semibold">
                            {discount.cardTitle || link.title}
                          </p>
                          {isFeatured ? (
                            <p className="mt-1 inline-flex rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
                              {t("preview_layout_featured_badge")}
                            </p>
                          ) : null}
                          <p className="truncate text-xs leading-relaxed opacity-80 sm:text-sm">
                            {t("preview_use_my_code")}
                          </p>
                        </div>
                      </div>
                      {discount.modalDescription ? (
                        <p className="text-xs leading-relaxed opacity-80 sm:text-sm">{discount.modalDescription}</p>
                      ) : null}
                      <p className="text-xs leading-relaxed opacity-85 sm:text-sm">{t("discount_open_details")}</p>
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
                          <SafeImage
                            src={safeHeroSrc}
                            alt=""
                            className="w-full rounded-2xl border border-white/20 object-cover max-h-[220px] sm:max-h-[260px] md:max-h-[320px]"
                            width={480}
                            height={320}
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
                const isFeatured = embedPost.layout === "featured";
                const cardThumbnailSrc =
                  normalizeImageSrc(embedPost.cardThumbnail, THUMBNAIL_FALLBACK_SRC) ??
                  THUMBNAIL_FALLBACK_SRC;
                const cardThumbnailKey = `${link.id}::embed-card::${cardThumbnailSrc}`;
                const safeCardThumbnailSrc = brokenThumbnailKeys[cardThumbnailKey]
                  ? THUMBNAIL_FALLBACK_SRC
                  : cardThumbnailSrc;
                const cardIconSrc = normalizeImageSrc(embedPost.cardIcon) ?? "";
                const cardIconKey = `${link.id}::embed-icon::${cardIconSrc}`;
                const safeCardIconSrc = brokenThumbnailKeys[cardIconKey]
                  ? THUMBNAIL_FALLBACK_SRC
                  : cardIconSrc;
                const parsedCtaHref = parsePreviewHref(embedPost.ctaUrl);
                const parsedSourceHref = parsePreviewHref(embedPost.sourceUrl);
                const isXProvider = embedPost.provider === "x";
                const providerModalClass = getProviderModalClass(embedPost.provider);
                const providerEmbedSrcDoc = buildProviderEmbedSrcDoc(
                  embedPost.provider,
                  embedPost.embedMode,
                  embedPost.embedCode,
                );
                const parsedXSourceHref = (() => {
                  if (!isXProvider) {
                    return parsedSourceHref;
                  }
                  const fallbackFromCode = getXPostUrlFromEmbedCode(embedPost.embedCode);
                  if (isWebExternalHref(parsedSourceHref)) {
                    return parsedSourceHref;
                  }
                  if (!fallbackFromCode) {
                    return { kind: "invalid", href: null } as PreviewHrefResult;
                  }
                  return { kind: "external", href: fallbackFromCode } as PreviewHrefResult;
                })();
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

                const renderEmbedCta = () => {
                  if (!parsedCtaHref.href || parsedCtaHref.kind === "invalid") {
                    return (
                      <span className={`${embedActionClass} border-white/30 opacity-65`}>
                        {t("preview_disabled_cta")}
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
                        {embedPost.ctaButtonLabel || t("embed_post_action_view_on_platform")}
                      </Link>
                    );
                  }

                  return (
                    <a
                      href={parsedCtaHref.href}
                      {...getExternalAnchorTargetProps(parsedCtaHref)}
                      className={`${embedActionClass} border-white/35`}
                      onClick={() => onPublicLinkClick?.(link.id, "cta")}
                    >
                      {embedPost.ctaButtonLabel || t("embed_post_action_view_on_platform")}
                    </a>
                  );
                };

                return (
                  <div key={link.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full space-y-3 border text-left font-semibold backdrop-blur-sm transition hover:brightness-105",
                        isFeatured ? "rounded-2xl shadow-xl" : "",
                        isAdminPreview ? "px-4 py-3 text-sm" : "p-4 text-sm sm:p-5 sm:text-base md:p-6",
                      )}
                      style={style}
                      onClick={() => {
                        setActiveEmbedId(link.id);
                        setActiveDiscountId(null);
                        setActivePreOpenKey(null);
                        onPublicLinkClick?.(link.id, "modal_open");
                      }}
                    >
                      <div className={cn("flex items-center gap-3", isFeatured && "items-start")}>
                        <SafeImage
                          src={safeCardThumbnailSrc}
                          alt=""
                          className={cn(
                            "rounded-md border border-black/10 object-cover",
                            isFeatured ? "h-16 w-20" : "size-10",
                          )}
                          width={isFeatured ? 80 : 40}
                          height={isFeatured ? 64 : 40}
                          onError={() => {
                            if (
                              safeCardThumbnailSrc === THUMBNAIL_FALLBACK_SRC ||
                              brokenThumbnailKeys[cardThumbnailKey]
                            ) {
                              return;
                            }
                            setBrokenThumbnailKeys((current) => ({ ...current, [cardThumbnailKey]: true }));
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm sm:text-base font-semibold">
                            {embedPost.cardTitle || link.title}
                          </p>
                          {isFeatured ? (
                            <p className="mt-1 inline-flex rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
                              {t("links_layout_featured")}
                            </p>
                          ) : null}
                          <p className="truncate text-xs leading-relaxed opacity-80 sm:text-sm">
                            {t("embed_post_public_open_in_modal")}
                          </p>
                        </div>
                        {cardIconSrc ? (
                          <span className="flex size-8 items-center justify-center rounded-md border border-white/20 p-1">
                          <SafeImage
                            src={safeCardIconSrc}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                            width={28}
                            height={28}
                            onError={() => {
                              if (
                                safeCardIconSrc === THUMBNAIL_FALLBACK_SRC ||
                                brokenThumbnailKeys[cardIconKey]
                              ) {
                                return;
                              }
                              setBrokenThumbnailKeys((current) => ({ ...current, [cardIconKey]: true }));
                            }}
                          />
                          </span>
                        ) : null}
                      </div>
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
                            <h3 className="text-base font-bold leading-tight sm:text-xl md:text-2xl">
                              {embedPost.modalTitle || embedPost.cardTitle}
                            </h3>
                            {embedPost.dismissible ? (
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
                              "w-full overflow-hidden rounded-[20px] border border-white/15 bg-black/25 sm:rounded-[24px]",
                            )}
                          >
                            <div className="w-full max-h-[52dvh] overflow-y-auto overscroll-contain touch-pan-y sm:max-h-[70vh]">
                              {embedUnavailable ? (
                                <div className="flex w-full min-h-[420px] items-center justify-center border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200 sm:min-h-[520px] md:min-h-[640px]">
                                  {t("embed_post_public_unavailable")}
                                </div>
                              ) : isXProvider && xEmbedMarkup ? (
                                <div className="w-full min-h-[420px] sm:min-h-[520px] md:min-h-[640px]">
                                  <XEmbedRenderer markup={xEmbedMarkup} />
                                </div>
                              ) : embedPost.embedMode === "code" ? (
                                <iframe
                                  title={embedPost.modalTitle || embedPost.cardTitle}
                                  className="w-full min-h-[420px] border border-white/10 bg-white sm:min-h-[520px] md:min-h-[640px]"
                                  sandbox="allow-scripts allow-same-origin allow-popups"
                                  srcDoc={
                                    providerEmbedSrcDoc ??
                                    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">${embedPost.embedCode}</body></html>`
                                  }
                                />
                              ) : iframeSrc ? (
                                <iframe
                                  title={embedPost.modalTitle || embedPost.cardTitle}
                                  className="w-full min-h-[420px] border border-white/10 bg-black sm:min-h-[520px] md:min-h-[640px]"
                                  src={iframeSrc}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                              ) : (
                                <div className="flex w-full min-h-[420px] items-center justify-center border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200 sm:min-h-[520px] md:min-h-[640px]">
                                  {t("embed_post_public_unavailable")}
                                </div>
                              )}
                            </div>
                          </div>

                          {embedPost.description ? (
                            <p className="px-1 py-3 text-sm text-zinc-200 sm:px-5 sm:py-4 sm:text-base">
                              {embedPost.description}
                            </p>
                          ) : null}
                          {isXProvider ? (
                            <>
                              <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-zinc-200 sm:mt-4">
                                <p className="mb-2 font-medium">Activity checklist (local confirmation only)</p>
                                {(
                                  [
                                    ["followed", "Followed"],
                                    ["reposted", "Reposted"],
                                    ["commented", "Commented"],
                                  ] as Array<[keyof XActivityChecklistState, string]>
                                ).map(([activityKey, label]) => {
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
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:mx-5 sm:mb-5 sm:mt-4 sm:grid-cols-2">
                                {parsedXSourceHref.kind === "external" && parsedXSourceHref.href ? (
                                  <a
                                    href={parsedXSourceHref.href}
                                    {...getExternalAnchorTargetProps(parsedXSourceHref)}
                                    className={`${embedActionClass} border-white/30`}
                                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                  >
                                    Open on X
                                  </a>
                                ) : (
                                  <span className={`${embedActionClass} border-white/30 opacity-65`}>
                                    Open on X
                                  </span>
                                )}
                                {parsedCtaHref.kind === "internal" && parsedCtaHref.href ? (
                                  <Link
                                    href={parsedCtaHref.href}
                                    className={`${embedActionClass} border-white/35`}
                                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                  >
                                    {embedPost.ctaButtonLabel || "Continue / Open source"}
                                  </Link>
                                ) : parsedCtaHref.kind === "external" && parsedCtaHref.href ? (
                                  <a
                                    href={parsedCtaHref.href}
                                    {...getExternalAnchorTargetProps(parsedCtaHref)}
                                    className={`${embedActionClass} border-white/35`}
                                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                  >
                                    {embedPost.ctaButtonLabel || "Continue / Open source"}
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    className={`${embedActionClass} cursor-not-allowed border-white/30 opacity-65`}
                                    disabled
                                  >
                                    {embedPost.ctaButtonLabel || "Continue / Open source"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`${embedActionClass} border-white/30 sm:col-span-2`}
                                  onClick={() => {
                                    if (embedPost.dismissible) {
                                      setActiveEmbedId(null);
                                    }
                                  }}
                                  disabled={!embedPost.dismissible}
                                >
                                  Close
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:mx-5 sm:mb-5 sm:mt-4 sm:grid-cols-2">
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
                                {embedPost.dismissible ? (
                                  <button
                                    type="button"
                                    className={`${embedActionClass} border-white/30 sm:col-span-2`}
                                    onClick={() => setActiveEmbedId(null)}
                                  >
                                    {t("embed_post_action_close")}
                                  </button>
                                ) : null}
                              </div>
                              {parsedCtaHref.kind === "invalid" ? (
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
                          {isXProvider && parsedCtaHref.kind === "invalid" ? (
                            <p className="mt-2 text-[11px] text-amber-300">{t("embed_post_validation_cta_invalid")}</p>
                          ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (isForm) {
                const isFeatured = form.layout === "featured";
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
                    if (field.type === "file_image") {
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
                      field.type === "time_hms" &&
                      !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(stringValue)
                    ) {
                      nextErrors[field.id] = t("form_error_time_invalid");
                      return;
                    }
                    if (
                      (field.type === "single_choice" ||
                        field.type === "checkboxes" ||
                        field.type === "dropdown") &&
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
                      className={cn(
                        "w-full space-y-2 border text-left font-semibold backdrop-blur-sm transition hover:brightness-105",
                        isFeatured ? "rounded-2xl p-5 shadow-xl" : "p-4",
                      )}
                      style={style}
                      onClick={() => {
                        const prefilledValues: FormSubmissionValues = {};
                        form.fields.forEach((field) => {
                          if (field.type === "checkboxes") {
                            return;
                          }
                          if (field.type === "file_image") {
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
                      <p className="text-sm font-semibold sm:text-base">{form.formTitle || link.title}</p>
                      {form.intro ? (
                        <p className="text-xs leading-relaxed opacity-85 sm:text-sm">{form.intro}</p>
                      ) : null}
                      <p className="text-[11px] opacity-80">{t("form_open_form")}</p>
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
                                    if (field.type === "checkboxes") {
                                      return {
                                        id: field.id,
                                        label: field.label,
                                        value: Array.isArray(raw) ? raw : [],
                                      };
                                    }
                                    if (field.type === "file_image") {
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
                                        field.type === "time_hms" && typeof raw === "string"
                                          ? normalizeTimeInputValue(raw)
                                          : typeof raw === "string"
                                            ? raw
                                            : "",
                                    };
                                  });

                                  if (!supportTemplate) {
                                    setFormSubmittedByLink((current) => ({ ...current, [link.id]: true }));
                                    return;
                                  }

                                  setFormSubmittingByLink((current) => ({ ...current, [link.id]: true }));
                                  setFormSubmitErrorByLink((current) => ({ ...current, [link.id]: "" }));

                                  const submitSupport = async () => {
                                    try {
                                      if (supportTemplate === "deposit_issue") {
                                        const slipField = form.fields.find((field) => field.type === "file_image");
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
                                        payload.append("responses", JSON.stringify(responses));
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
                                  const showOptions =
                                    field.type === "single_choice" ||
                                    field.type === "checkboxes" ||
                                    field.type === "dropdown";

                                  return (
                                    <div key={field.id} className="space-y-1.5">
                                      <label className="text-sm font-medium text-zinc-200">
                                        {field.label}
                                        {field.required ? " *" : ""}
                                      </label>
                                    {field.type === "paragraph" ? (
                                      <textarea
                                        name={fieldName}
                                        className="min-h-[96px] w-full rounded-md border border-white/20 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                                          value={typeof fieldValue === "string" ? fieldValue : ""}
                                          placeholder={field.placeholder ?? ""}
                                          onFocus={handleFieldFocus}
                                          onChange={(event) => setStringFieldValue(field.id, event.target.value)}
                                        />
                                      ) : field.type === "file_image" ? (
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
                                      ) : field.type === "single_choice" && showOptions ? (
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
                                      ) : field.type === "checkboxes" && showOptions ? (
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
                                      ) : field.type === "dropdown" && showOptions ? (
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
                                      ) : field.type === "time_hms" ? (
                                        <input
                                          name={supportTemplate === "deposit_issue" ? "transactionTime" : fieldName}
                                          type="time"
                                          step="1"
                                          required={field.required}
                                          className="h-11 w-full rounded-md border border-white/20 bg-black/35 px-3 text-sm text-white outline-none"
                                          value={toHtmlTimeValue(typeof fieldValue === "string" ? fieldValue : "")}
                                          onFocus={handleFieldFocus}
                                          onChange={(event) =>
                                            setStringFieldValue(field.id, normalizeTimeInputValue(event.target.value))
                                          }
                                        />
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
                    window.open(target.href, "_blank", "noopener,noreferrer");
                    return;
                  }
                  window.location.assign(target.href);
                };
                const continueWithDefaultAction = () => {
                  if (isDiscount) {
                    setActiveDiscountId(link.id);
                    setActiveEmbedId(null);
                    setActiveFormId(null);
                    if (discount.analyticsHooks?.trackModalOpen ?? true) {
                      onPublicLinkClick?.(link.id, "modal_open");
                    }
                    return;
                  }
                  if (isEmbedPost) {
                    setActiveEmbedId(link.id);
                    setActiveDiscountId(null);
                    setActiveFormId(null);
                    onPublicLinkClick?.(link.id, "modal_open");
                    return;
                  }
                  if (isForm) {
                    const prefilledValues: FormSubmissionValues = {};
                    form.fields.forEach((field) => {
                      if (field.type === "checkboxes" || field.type === "file_image") {
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
                    {...getExternalAnchorTargetProps(parsedHref)}
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
                  {...getExternalAnchorTargetProps(parsedHref)}
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

