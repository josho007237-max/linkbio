"use client";

import { CSSProperties } from "react";

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

export const PublicProfile = ({
  profile,
  slug,
  clickSummary: _clickSummary,
  onPublicLinkClick,
}: PublicProfileProps) => {
  void _clickSummary;
  const { language, setLanguage, t } = useI18n();
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

      <div className="relative z-10 mx-auto w-full max-w-[680px] px-4 pt-12 sm:px-5 sm:pt-14 md:px-6">
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
