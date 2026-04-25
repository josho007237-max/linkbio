"use client";

import { SafeImage } from "@/components/shared/safe-image";

import { BuilderData } from "@/features/builder/types";
import { cn } from "@/lib/utils";

type ProfileHeaderProps = {
  data: BuilderData;
  avatarSrc: string;
  heroHeaderSrc: string;
  onAvatarError: () => void;
  onHeroImageError: () => void;
  flushToTop?: boolean;
};

export const ProfileHeader = ({
  data,
  avatarSrc,
  heroHeaderSrc,
  onAvatarError,
  onHeroImageError,
  flushToTop = false,
}: ProfileHeaderProps) => {
  const publicHandle =
    data.header.publicHandle?.trim() ||
    data.header.publicUsername?.trim() ||
    data.header.username;

  const titleColor = data.theme.titleColor ?? data.theme.textColor;
  const titleSize = data.theme.titleSize ?? 28;
  const displayTitle =
    data.header.titleMode === "username"
      ? `@${publicHandle}`
      : data.header.displayName;

  const heroTextAlign = data.header.heroTextAlign ?? "center";
  const heroOverlay = data.header.heroOverlay ?? true;
  const heroOverlayStrength = data.header.heroOverlayStrength ?? 0.35;
  const hasHeroImage = Boolean(data.header.heroImageUrl?.trim());
  const pageBackground = data.theme.pageBackground || "#111827";
  const heroFallbackGradient = `linear-gradient(135deg, ${data.theme.buttonBackground || "#334155"} 0%, ${pageBackground} 100%)`;

  const tagline = data.header.tagline?.trim() ?? "";
  const intro = data.text.intro?.trim() ?? "";
  const body = data.text.body?.trim() ?? "";

  if (data.header.layout === "none") {
    return null;
  }

  if (data.header.layout === "hero") {
    return (
      <section className={cn("-mx-5 mb-2", flushToTop ? "mt-0" : "-mt-6")}>
        <div
          className="relative h-[220px] w-full overflow-hidden rounded-t-[28px] sm:h-[260px] md:h-[320px]"
          style={{ ["--page-bg" as string]: pageBackground }}
        >
          {hasHeroImage ? (
            <SafeImage
              src={heroHeaderSrc}
              alt={data.header.displayName}
              className="absolute inset-0 h-full w-full object-cover"
              width={640}
              height={360}
              onError={onHeroImageError}
            />
          ) : (
            <div
              className="absolute inset-0 h-full w-full"
              style={{ background: heroFallbackGradient }}
              aria-hidden="true"
            />
          )}

          {heroOverlay ? (
            <div
              className="absolute inset-0"
              style={{
                background: `rgba(0, 0, 0, ${Math.max(0.25, Math.min(0.85, heroOverlayStrength))})`,
              }}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-black/25" />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-black/25 to-[var(--page-bg)]"
            aria-hidden="true"
          />

          <div
            className={cn(
              "relative z-10 flex h-full flex-col justify-end px-4 pb-5 sm:px-5 sm:pb-6 md:px-6 md:pb-7",
              heroTextAlign === "left" ? "text-left" : "text-center",
            )}
          >
            <h2 className="text-2xl font-bold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-3xl md:text-4xl">
              {displayTitle}
            </h2>

            <p className="mt-1 text-sm text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)] sm:text-base">
              @{publicHandle}
            </p>

            {tagline ? (
              <p className="mt-1 text-sm font-medium text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)] sm:text-base">
                {tagline}
              </p>
            ) : null}
          </div>
        </div>

        {(intro || body) ? (
          <div
            className={cn(
              "space-y-2 px-5 pt-3",
              heroTextAlign === "left" ? "text-left" : "text-center",
            )}
          >
            {intro ? <p className="text-sm font-medium">{intro}</p> : null}

            {body ? (
              <p
                className="text-xs leading-5"
                style={{ color: data.theme.mutedTextColor }}
              >
                {body}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div
      className="rounded-3xl border border-white/15 p-4 shadow-xl backdrop-blur-md"
      style={{ background: data.theme.cardBackground }}
    >
      <div className="mx-auto mb-4 size-20 overflow-hidden rounded-full border border-white/20">
        <SafeImage
          src={avatarSrc}
          alt={data.header.displayName}
          className="h-full w-full object-cover"
          width={80}
          height={80}
          onError={onAvatarError}
        />
      </div>

      <h2
        className="text-center font-bold"
        style={{ color: titleColor, fontSize: `${titleSize}px`, lineHeight: 1.15 }}
      >
        {displayTitle}
      </h2>

      <p className="mt-1 text-center text-sm" style={{ color: data.theme.mutedTextColor }}>
        @{publicHandle}
      </p>

      {tagline ? (
        <p className="mt-2 text-center text-xs font-medium opacity-90">{tagline}</p>
      ) : null}

      {intro ? (
        <p className="mt-4 text-center text-sm font-medium">{intro}</p>
      ) : null}

      {body ? (
        <p
          className="mt-2 text-center text-xs leading-5"
          style={{ color: data.theme.mutedTextColor }}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
};
