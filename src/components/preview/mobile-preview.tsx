"use client";

import Link from "next/link";
import Image from "next/image";
import { ComponentType, useEffect, useMemo, useState } from "react";
import {
  Globe,
  Link2,
  Lock,
  Music2,
  Play,
  X,
} from "lucide-react";

import { BuilderData, SocialLink } from "@/features/builder/types";
import {
  getContentType,
  getDiscountData,
  getEmbedPostData,
  getSortedVisibleLinks,
} from "@/features/builder/utils";
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

const AVATAR_FALLBACK_SRC = "/placeholders/avatar-default.svg";
const WALLPAPER_FALLBACK_SRC = "/placeholders/wallpaper-default.svg";
const THUMBNAIL_FALLBACK_SRC = "/placeholders/link-thumbnail-default.svg";

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
  if (social.iconUrl) {
    return (
      <Image
        src={social.iconUrl}
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
  if (provider === "x" || provider === "tiktok" || provider === "facebook") {
    return sourceUrl;
  }
  return null;
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

  const wallpaperRequestSrc = useMemo(
    () => data.theme.wallpaperUrl || WALLPAPER_FALLBACK_SRC,
    [data.theme.wallpaperUrl],
  );
  const wallpaperSrc = brokenWallpaperSources[wallpaperRequestSrc]
    ? WALLPAPER_FALLBACK_SRC
    : wallpaperRequestSrc;
  const avatarRequestSrc = data.header.avatarUrl || AVATAR_FALLBACK_SRC;
  const avatarSrc = brokenAvatarSources[avatarRequestSrc]
    ? AVATAR_FALLBACK_SRC
    : avatarRequestSrc;
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

  return (
    <div className="mx-auto w-full max-w-[390px] rounded-[40px] border-8 border-zinc-900/95 bg-zinc-950 p-2 shadow-[0_18px_60px_rgba(2,6,23,0.5)]">
      <div
        className="relative h-[760px] overflow-hidden rounded-[30px] border border-white/15"
        style={{
          backgroundColor: data.theme.pageBackground,
          color: data.theme.textColor,
        }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${wallpaperSrc})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/65" />

        <div className="relative flex h-full flex-col overflow-y-auto px-5 py-6">
          <div
            className="rounded-3xl border border-white/15 p-4 shadow-xl backdrop-blur-md"
            style={{ background: data.theme.cardBackground }}
          >
            <div className="mx-auto mb-4 size-20 overflow-hidden rounded-full border border-white/20">
              <Image
                src={avatarSrc}
                alt={data.header.displayName}
                className="h-full w-full object-cover"
                width={80}
                height={80}
                onError={() => {
                  if (avatarSrc === AVATAR_FALLBACK_SRC || brokenAvatarSources[avatarRequestSrc]) {
                    return;
                  }
                  setBrokenAvatarSources((current) => ({
                    ...current,
                    [avatarRequestSrc]: true,
                  }));
                }}
              />
            </div>
            <h2 className="text-center text-xl font-bold">{data.header.displayName}</h2>
            <p className="mt-1 text-center text-sm" style={{ color: data.theme.mutedTextColor }}>
              @{data.header.username}
            </p>
            <p className="mt-2 text-center text-xs font-medium opacity-90">{data.header.tagline}</p>
            <p className="mt-4 text-center text-sm font-medium">{data.text.intro}</p>
            <p className="mt-2 text-center text-xs leading-5" style={{ color: data.theme.mutedTextColor }}>
              {data.text.body}
            </p>

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
          </div>

          <div className="mt-5 space-y-3 pb-6">
            {visibleLinks.map((link) => {
              const thumbnailSrc = link.settings.thumbnailUrl || THUMBNAIL_FALLBACK_SRC;
              const thumbnailKey = `${link.id}::${thumbnailSrc}`;
              const safeThumbnailSrc = brokenThumbnailKeys[thumbnailKey]
                ? THUMBNAIL_FALLBACK_SRC
                : thumbnailSrc;
              const className = cn(
                "flex items-center gap-3 border px-4 py-3 text-sm font-semibold backdrop-blur-sm transition hover:brightness-105",
                data.buttonStyle.uppercase && "uppercase tracking-wide",
                data.buttonStyle.shadow && "shadow-lg shadow-black/30",
              );
              const style = {
                backgroundColor: data.theme.buttonBackground,
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
                const cardThumbnailSrc = discount.cardThumbnail;
                const cardThumbnailKey = `${link.id}::card::${cardThumbnailSrc}`;
                const safeCardThumbnailSrc = brokenThumbnailKeys[cardThumbnailKey]
                  ? THUMBNAIL_FALLBACK_SRC
                  : cardThumbnailSrc;
                const destinationParsed = parsePreviewHref(discount.destinationUrl);
                const heroSrc = discount.modalHeroImage;
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
                const cardThumbnailSrc = embedPost.cardThumbnail || THUMBNAIL_FALLBACK_SRC;
                const cardThumbnailKey = `${link.id}::embed-card::${cardThumbnailSrc}`;
                const safeCardThumbnailSrc = brokenThumbnailKeys[cardThumbnailKey]
                  ? THUMBNAIL_FALLBACK_SRC
                  : cardThumbnailSrc;
                const cardIconSrc = embedPost.cardIcon || "";
                const cardIconKey = `${link.id}::embed-icon::${cardIconSrc}`;
                const safeCardIconSrc = brokenThumbnailKeys[cardIconKey]
                  ? THUMBNAIL_FALLBACK_SRC
                  : cardIconSrc;
                const parsedCtaHref = parsePreviewHref(embedPost.ctaUrl);
                const parsedSourceHref = parsePreviewHref(embedPost.sourceUrl);
                const hasValidSourceInput =
                  embedPost.embedMode === "code"
                    ? Boolean(embedPost.embedCode.trim())
                    : parsedSourceHref.kind === "external" && Boolean(parsedSourceHref.href);
                const iframeSrc = embedPost.embedMode === "url" && parsedSourceHref.href
                  ? getEmbedSrcFromProvider(embedPost.provider, parsedSourceHref.href)
                  : null;
                const embedUnavailable =
                  !hasValidSourceInput ||
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
                          className="w-full max-w-2xl rounded-2xl border border-white/20 bg-zinc-950 p-4 text-white shadow-2xl"
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

                          <div className="rounded-xl border border-white/15 bg-black/25 p-2">
                            {embedUnavailable ? (
                              <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-white/20 px-4 text-center text-sm text-zinc-200">
                                {t("embed_post_public_unavailable")}
                              </div>
                            ) : embedPost.embedMode === "code" ? (
                              <iframe
                                title={embedPost.modalTitle || embedPost.cardTitle}
                                className="h-[300px] w-full rounded-lg border border-white/10 bg-white"
                                sandbox="allow-scripts allow-same-origin allow-popups"
                                srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">${embedPost.embedCode}</body></html>`}
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
          </div>
        </div>
      </div>
      {mode === "admin" ? (
        <p className="pt-3 text-center text-xs text-muted-foreground">{t("preview_footer_admin")}</p>
      ) : null}
    </div>
  );
};
