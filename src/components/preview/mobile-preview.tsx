"use client";

import Link from "next/link";
import Image from "next/image";
import { ComponentType, useEffect, useMemo, useRef, useState } from "react";
import {
  Globe,
  Link2,
  Lock,
  Music2,
  Play,
  X,
} from "lucide-react";

import { BuilderData, SocialLink } from "@/features/builder/types";
import { ProfileHeader } from "@/components/profile/profile-header";
import {
  getContentType,
  getDiscountData,
  getEmbedPostData,
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
import { useI18n } from "@/i18n/use-i18n";
import { cn } from "@/lib/utils";

type MobilePreviewProps = {
  data: BuilderData;
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

const WALLPAPER_FALLBACK_SRC = "/placeholders/wallpaper-default.svg";
const THUMBNAIL_FALLBACK_SRC = "/placeholders/link-thumbnail-default.svg";

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
  youtube: Play,
  x: Link2,
  facebook: Link2,
  website: Globe,
};

const SocialVisual = ({ social }: { social: SocialLink }) => {
  const Icon = socialIconMap[social.platform];
  const iconSrc = normalizeImageSrc(social.iconUrl);
  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt=""
        width={16}
        height={16}
        className="size-4 rounded object-cover"
      />
    );
  }
  return <Icon className="size-4" />;
};

const parsePreviewHref = (href: string): PreviewHrefResult => {
  const value = href.trim();

  if (!value) {
    return { kind: "invalid", href: null };
  }

  if (value.startsWith("/")) {
    return { kind: "internal", href: value };
  }

  if (value === "http://" || value === "https://") {
    return { kind: "invalid", href: null };
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      if (!parsed.hostname) {
        return { kind: "invalid", href: null };
      }
      return { kind: "external", href: parsed.toString() };
    } catch {
      return { kind: "invalid", href: null };
    }
  }

  return { kind: "invalid", href: null };
};

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
    return "max-w-4xl";
  }
  return "max-w-2xl";
};

const getXPostUrlFromEmbedCode = (embedCode: string): string | null => {
  const citeMatch = embedCode.match(/cite=["']([^"']+)["']/i);
  const hrefMatch = embedCode.match(/href=["']([^"']+)["']/i);
  const rawCandidate = citeMatch?.[1] || hrefMatch?.[1] || "";
  const parsed = parsePreviewHref(rawCandidate);
  if (parsed.kind !== "external" || !parsed.href) {
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
  if (parsed.kind !== "external" || !parsed.href) {
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
    <div className="mx-auto w-full max-w-[550px] rounded-lg border border-white/10 bg-white p-2 text-black">
      <div ref={containerRef} />
    </div>
  );
};

export const MobilePreview = ({
  data,
  mode = "admin",
  onPublicLinkClick,
}: MobilePreviewProps) => {
  const { t } = useI18n();
  const visibleLinks = getSortedVisibleLinks(data);
  const [brokenAvatarSources, setBrokenAvatarSources] = useState<Record<string, true>>({});
  const [brokenWallpaperSources, setBrokenWallpaperSources] = useState<Record<string, true>>({});
  const [brokenThumbnailKeys, setBrokenThumbnailKeys] = useState<Record<string, true>>({});
  const [brokenHeroKeys, setBrokenHeroKeys] = useState<Record<string, true>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedEmbedLinkId, setCopiedEmbedLinkId] = useState<string | null>(null);
  const [activeDiscountId, setActiveDiscountId] = useState<string | null>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
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
    if (!activeDiscountId && !activeEmbedId) {
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
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeDiscountId, activeEmbedDismissible, activeEmbedId]);

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
    <div className="mx-auto w-full max-w-[390px] rounded-[40px] border-8 border-zinc-900/95 bg-zinc-950 p-2 shadow-[0_18px_60px_rgba(2,6,23,0.5)]">
      <div
        className="relative h-[760px] overflow-hidden rounded-[30px] border border-white/15"
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

        <div className="relative flex h-full flex-col overflow-y-auto px-5 py-6">
          <ProfileHeader
            data={data}
            avatarSrc={avatarSrc}
            heroHeaderSrc={heroHeaderSrc}
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
                        className="cursor-not-allowed rounded-full border border-white/20 p-2 opacity-50"
                      >
                        <SocialVisual social={social} />
                      </span>
                    );
                  }

                  return (
                    <a
                      key={social.id}
                      href={parsedHref.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/25 p-2 transition hover:bg-white/10"
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
                "flex items-center gap-3 border px-4 py-3 text-sm font-semibold backdrop-blur-sm transition hover:brightness-105",
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
              const discount = getDiscountData(link);
              const embedPost = getEmbedPostData(link);
              const discountLayout = discount.layout;

              const renderDiscountCta = (
                parsedDiscountHref: PreviewHrefResult,
              ) => {
                const ctaLabel = discount.ctaButtonLabel || t("preview_disabled_cta");
                if (!parsedDiscountHref.href || parsedDiscountHref.kind === "invalid") {
                  return (
                    <span className="inline-flex items-center rounded-md border border-white/30 px-3 py-1.5 text-xs opacity-65">
                      {t("preview_disabled_cta")}
                    </span>
                  );
                }

                if (parsedDiscountHref.kind === "internal") {
                  return (
                    <Link
                      href={parsedDiscountHref.href}
                      className="inline-flex items-center rounded-md border border-white/35 px-3 py-1.5 text-xs"
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
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-md border border-white/35 px-3 py-1.5 text-xs"
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
                  <Image
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
                    <p className="truncate">{link.title}</p>
                    {link.description ? (
                      <p className="truncate text-[11px] opacity-80">{link.description}</p>
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
                        "w-full space-y-3 border text-left text-sm font-semibold backdrop-blur-sm transition hover:brightness-105",
                        isFeatured ? "rounded-2xl px-4 py-4 shadow-xl" : "px-4 py-3",
                      )}
                      style={style}
                      onClick={() => {
                        setActiveDiscountId(link.id);
                        setActiveEmbedId(null);
                        if (discount.analyticsHooks?.trackModalOpen ?? true) {
                          onPublicLinkClick?.(link.id, "modal_open");
                        }
                      }}
                    >
                      <div className={cn("flex items-center gap-3", isFeatured && "items-start")}>
                        <Image
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
                          <p className="truncate">{discount.cardTitle || link.title}</p>
                          {isFeatured ? (
                            <p className="mt-1 inline-flex rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
                              {t("preview_layout_featured_badge")}
                            </p>
                          ) : null}
                          <p className="truncate text-[11px] opacity-80">
                            {t("preview_use_my_code")}
                          </p>
                        </div>
                      </div>
                      {discount.modalDescription ? (
                        <p className="text-[11px] opacity-80">{discount.modalDescription}</p>
                      ) : null}
                      <p className="text-[11px] opacity-85">{t("discount_open_details")}</p>
                    </button>

                    {activeDiscountId === link.id ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
                        onClick={() => setActiveDiscountId(null)}
                      >
                        <div
                          className="w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="text-base font-semibold">{discount.modalTitle}</h3>
                            <button
                              type="button"
                              className="rounded-md border border-white/25 p-1"
                              onClick={() => setActiveDiscountId(null)}
                              aria-label={t("discount_close_button_label")}
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                          <Image
                            src={safeHeroSrc}
                            alt=""
                            className="h-40 w-full rounded-lg border border-white/20 object-cover"
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
                          <p className="mt-3 text-sm text-zinc-200">{discount.modalDescription}</p>
                          <div className="mt-4 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-white/30 px-3 py-1 text-xs"
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
                  if (parsedSourceHref.kind === "external" && parsedSourceHref.href) {
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
                    : parsedSourceHref.kind === "external" && Boolean(parsedSourceHref.href);
                const iframeSrc = embedPost.embedMode === "url" && parsedSourceHref.href
                  ? getEmbedSrcFromProvider(embedPost.provider, parsedSourceHref.href)
                  : null;
                const embedUnavailable =
                  isXProvider
                    ? !xEmbedMarkup
                    : !hasValidSourceInput ||
                      (embedPost.embedMode === "url" && embedPost.provider === "youtube" && !iframeSrc);

                const renderEmbedCta = () => {
                  if (!parsedCtaHref.href || parsedCtaHref.kind === "invalid") {
                    return (
                      <span className="inline-flex items-center rounded-md border border-white/30 px-3 py-1.5 text-xs opacity-65">
                        {t("preview_disabled_cta")}
                      </span>
                    );
                  }

                  if (parsedCtaHref.kind === "internal") {
                    return (
                      <Link
                        href={parsedCtaHref.href}
                        className="inline-flex items-center rounded-md border border-white/35 px-3 py-1.5 text-xs"
                        onClick={() => onPublicLinkClick?.(link.id, "cta")}
                      >
                        {embedPost.ctaButtonLabel || t("embed_post_action_view_on_platform")}
                      </Link>
                    );
                  }

                  return (
                    <a
                      href={parsedCtaHref.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-md border border-white/35 px-3 py-1.5 text-xs"
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
                        "w-full space-y-3 border text-left text-sm font-semibold backdrop-blur-sm transition hover:brightness-105",
                        isFeatured ? "rounded-2xl px-4 py-4 shadow-xl" : "px-4 py-3",
                      )}
                      style={style}
                      onClick={() => {
                        setActiveEmbedId(link.id);
                        setActiveDiscountId(null);
                        onPublicLinkClick?.(link.id, "modal_open");
                      }}
                    >
                      <div className={cn("flex items-center gap-3", isFeatured && "items-start")}>
                        <Image
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
                          <p className="truncate">{embedPost.cardTitle || link.title}</p>
                          {isFeatured ? (
                            <p className="mt-1 inline-flex rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
                              {t("links_layout_featured")}
                            </p>
                          ) : null}
                          <p className="truncate text-[11px] opacity-80">
                            {t("embed_post_public_open_in_modal")}
                          </p>
                        </div>
                        {cardIconSrc ? (
                          <Image
                            src={safeCardIconSrc}
                            alt=""
                            className="size-7 rounded-md border border-white/20 object-cover"
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
                        ) : null}
                      </div>
                    </button>

                    {activeEmbedId === link.id ? (
                      <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
                        onClick={() => {
                          if (embedPost.dismissible) {
                            setActiveEmbedId(null);
                          }
                        }}
                      >
                        <div
                          className={cn(
                            "w-full rounded-2xl border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl",
                            providerModalClass,
                          )}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="text-base font-semibold">{embedPost.modalTitle || embedPost.cardTitle}</h3>
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

                          <div
                            className={cn(
                              "rounded-xl border border-white/15 bg-black/25 p-2",
                              isXProvider ? "max-h-[78vh] overflow-y-auto" : "",
                            )}
                          >
                            {embedUnavailable ? (
                              <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200">
                                {t("embed_post_public_unavailable")}
                              </div>
                            ) : isXProvider && xEmbedMarkup ? (
                              <XEmbedRenderer markup={xEmbedMarkup} />
                            ) : embedPost.embedMode === "code" ? (
                              <iframe
                                title={embedPost.modalTitle || embedPost.cardTitle}
                                className="h-[300px] w-full rounded-lg border border-white/10 bg-white"
                                sandbox="allow-scripts allow-same-origin allow-popups"
                                srcDoc={
                                  providerEmbedSrcDoc ??
                                  `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">${embedPost.embedCode}</body></html>`
                                }
                              />
                            ) : iframeSrc ? (
                              <iframe
                                title={embedPost.modalTitle || embedPost.cardTitle}
                                className="h-[300px] w-full rounded-lg border border-white/10 bg-black"
                                src={iframeSrc}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            ) : (
                              <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200">
                                {t("embed_post_public_unavailable")}
                              </div>
                            )}
                          </div>

                          {embedPost.description ? (
                            <p className="mt-3 text-sm text-zinc-200">{embedPost.description}</p>
                          ) : null}
                          {isXProvider ? (
                            <>
                              <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-zinc-200">
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
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                {parsedXSourceHref.kind === "external" && parsedXSourceHref.href ? (
                                  <a
                                    href={parsedXSourceHref.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md border border-white/30 px-3 py-1.5 text-xs"
                                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                  >
                                    Open on X
                                  </a>
                                ) : (
                                  <span className="rounded-md border border-white/30 px-3 py-1.5 text-xs opacity-65">
                                    Open on X
                                  </span>
                                )}
                                {parsedCtaHref.kind === "internal" && parsedCtaHref.href ? (
                                  <Link
                                    href={parsedCtaHref.href}
                                    className="rounded-md border border-white/35 px-3 py-1.5 text-xs"
                                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                  >
                                    {embedPost.ctaButtonLabel || "Continue / Open source"}
                                  </Link>
                                ) : parsedCtaHref.kind === "external" && parsedCtaHref.href ? (
                                  <a
                                    href={parsedCtaHref.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md border border-white/35 px-3 py-1.5 text-xs"
                                    onClick={() => onPublicLinkClick?.(link.id, "cta")}
                                  >
                                    {embedPost.ctaButtonLabel || "Continue / Open source"}
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    className="cursor-not-allowed rounded-md border border-white/30 px-3 py-1.5 text-xs opacity-65"
                                    disabled
                                  >
                                    {embedPost.ctaButtonLabel || "Continue / Open source"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="rounded-md border border-white/30 px-3 py-1.5 text-xs"
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
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-md border border-white/30 px-3 py-1.5 text-xs"
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
                                    className="rounded-md border border-white/30 px-3 py-1.5 text-xs"
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
                    target="_blank"
                    rel="noreferrer"
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
                  target="_blank"
                  rel="noreferrer"
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
