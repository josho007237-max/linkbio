"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Copy, Share2, X } from "lucide-react";

import { ClickSummary } from "@/lib/local-storage/analytics-storage";
import { BuilderData } from "@/features/builder/types";
import { MobilePreview } from "@/components/preview/mobile-preview";
import { useI18n } from "@/i18n/use-i18n";

type PublicProfileProps = {
  profile: BuilderData;
  slug: string;
  clickSummary: ClickSummary;
  onPublicLinkClick: (
    linkId: string,
    eventType?: "cta" | "copy" | "modal_open",
  ) => void;
};

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

const copyTextToClipboard = async (value: string): Promise<boolean> => {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback to execCommand below.
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.focus();
    input.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(input);
    return succeeded;
  } catch {
    return false;
  }
};

export const PublicProfile = ({
  profile,
  slug,
  clickSummary: _clickSummary,
  onPublicLinkClick,
}: PublicProfileProps) => {
  void _clickSummary;
  const { language, setLanguage, t } = useI18n();
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [copyToastFailed, setCopyToastFailed] = useState(false);

  useEffect(() => {
    if (!copyToastVisible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopyToastVisible(false);
      setCopyToastFailed(false);
    }, 1700);
    return () => window.clearTimeout(timer);
  }, [copyToastVisible]);

  const shareTitle = useMemo(() => {
    const fromMeta = profile.header.shareTitle?.trim();
    if (fromMeta) {
      return fromMeta;
    }
    const fromName = profile.header.displayName?.trim();
    if (fromName) {
      return fromName;
    }
    const fromTagline = profile.header.tagline?.trim();
    if (fromTagline) {
      return fromTagline;
    }
    return profile.header.username || slug;
  }, [profile.header.displayName, profile.header.shareTitle, profile.header.tagline, profile.header.username, slug]);

  const shareDescription = useMemo(() => {
    const fromMeta = profile.header.shareDescription?.trim();
    if (fromMeta) {
      return fromMeta;
    }
    const fromTagline = profile.header.tagline?.trim();
    if (fromTagline) {
      return fromTagline;
    }
    return "";
  }, [profile.header.shareDescription, profile.header.tagline]);

  const shareUrl =
    typeof window !== "undefined" && window.location.href.trim()
      ? window.location.href.trim()
      : `/${slug}`;

  const tryCopyLink = async () => {
    const copied = await copyTextToClipboard(shareUrl);
    setCopyToastFailed(!copied);
    setCopyToastVisible(true);
    return copied;
  };

  const handleShareClick = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareDescription || shareTitle,
          url: shareUrl,
        });
        return;
      } catch {
        // User canceled or native share failed; fall through to popup menu.
      }
    }
    setShareMenuOpen(true);
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);
  const shareTargets = [
    {
      key: "line",
      label: "LINE",
      href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      key: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      key: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      key: "messenger",
      label: "Messenger",
      href: `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=87741124305&redirect_uri=${encodedUrl}`,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareTitle}\n${shareDescription ? `${shareDescription}\n` : ""}${shareUrl}`)}`,
    },
  ] as const;

  const pageFontFamily =
    profile.theme.pageFont === "poppins"
      ? "'Poppins', 'Segoe UI', sans-serif"
      : profile.theme.pageFont === "manrope"
        ? "'Manrope', 'Segoe UI', sans-serif"
        : profile.theme.pageFont === "space_grotesk"
          ? "'Space Grotesk', 'Segoe UI', sans-serif"
          : "'Inter', 'Segoe UI', sans-serif";
  const wallpaperStyle = profile.theme.wallpaperStyle ?? "image";
  const wallpaperSrc = normalizeImageSrc(profile.theme.wallpaperUrl);
  const wallpaperVideoSrc = normalizeImageSrc(profile.theme.wallpaperVideoUrl);
  const mainStyle: CSSProperties = {
    backgroundColor: profile.theme.pageBackground,
    color: profile.theme.textColor,
    fontFamily: pageFontFamily,
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-8 sm:pb-10" style={mainStyle}>
      {wallpaperStyle === "video" && wallpaperVideoSrc ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          src={wallpaperVideoSrc}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : wallpaperStyle !== "fill" && wallpaperSrc ? (
        <div
          className={`absolute inset-0 bg-cover bg-center opacity-35 ${wallpaperStyle === "blur" ? "scale-110 blur-sm" : ""}`}
          style={{ backgroundImage: `url(${wallpaperSrc})` }}
        />
      ) : null}
      {wallpaperStyle === "gradient" ? (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${profile.theme.pageBackground}, ${profile.theme.buttonBackground})`,
          }}
        />
      ) : null}
      {wallpaperStyle === "pattern" ? (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.14) 2px, transparent 2px, transparent 10px)",
          }}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/45" />

      <div className="fixed top-3 right-3 z-20 sm:top-4 sm:right-4 md:top-5 md:right-6">
        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 p-1">
            <span className="px-1 text-[10px] text-muted-foreground">{t("language_switch_label")}</span>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                language === "en" ? "bg-primary/15 text-foreground" : "text-muted-foreground"
              }`}
            >
              {t("lang_en")}
            </button>
            <button
              type="button"
              onClick={() => setLanguage("th")}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                language === "th" ? "bg-primary/15 text-foreground" : "text-muted-foreground"
              }`}
            >
              {t("lang_th")}
            </button>
        </div>
      </div>
      <div className="fixed left-3 top-3 z-20 flex flex-col items-start gap-2 sm:left-4 sm:top-4 md:left-6 md:top-5">
        <div className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/45 p-1 shadow-md backdrop-blur">
          <button
            type="button"
            onClick={() => void handleShareClick()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white transition hover:bg-white/10"
            aria-label={t("public_share_button")}
          >
            <Share2 className="size-3.5" />
            {t("public_share_button")}
          </button>
          <button
            type="button"
            onClick={() => void tryCopyLink()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white transition hover:bg-white/10"
            aria-label={t("public_copy_link_button")}
          >
            <Copy className="size-3.5" />
            {t("public_copy_link_button")}
          </button>
        </div>
        {copyToastVisible ? (
          <div className="rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[11px] text-white shadow-sm backdrop-blur">
            {copyToastFailed ? t("public_copy_link_failed") : t("public_copy_link_success")}
          </div>
        ) : null}
      </div>
      {shareMenuOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-start justify-start bg-black/45 p-3 sm:p-4"
          onClick={() => setShareMenuOpen(false)}
        >
          <div
            className="w-[min(320px,100%)] rounded-xl border border-white/20 bg-zinc-950/95 p-3 text-white shadow-xl backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("public_share_modal_title")}</h2>
              <button
                type="button"
                onClick={() => setShareMenuOpen(false)}
                className="rounded-md p-1 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label={t("embed_post_action_close")}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-300">{shareDescription || shareTitle}</p>
            <div className="grid grid-cols-2 gap-2">
              {shareTargets.map((target) => (
                <a
                  key={target.key}
                  href={target.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-white/15 px-2 py-2 text-xs font-medium transition hover:bg-white/10"
                >
                  {target.label}
                </a>
              ))}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-white/15 px-2 py-2 text-xs font-medium transition hover:bg-white/10"
                onClick={() => {
                  void tryCopyLink();
                  setShareMenuOpen(false);
                }}
              >
                {t("public_copy_link_button")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative z-10 mx-auto w-full max-w-[390px] pt-12 sm:pt-14">
        <MobilePreview
          data={profile}
          routeSlug={slug}
          mode="public"
          onPublicLinkClick={onPublicLinkClick}
        />
      </div>
    </main>
  );
};
