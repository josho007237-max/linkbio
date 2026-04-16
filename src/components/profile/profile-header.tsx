"use client";

import Image from "next/image";

import { BuilderData } from "@/features/builder/types";
import { cn } from "@/lib/utils";

type ProfileHeaderProps = {
  data: BuilderData;
  avatarSrc: string;
  heroHeaderSrc: string;
  onAvatarError: () => void;
  onHeroImageError: () => void;
};

export const ProfileHeader = ({
  data,
  avatarSrc,
  heroHeaderSrc,
  onAvatarError,
  onHeroImageError,
}: ProfileHeaderProps) => {
  const titleColor = data.theme.titleColor ?? data.theme.textColor;
  const titleSize = data.theme.titleSize ?? 28;
  const displayTitle =
    data.header.titleMode === "username"
      ? `@${data.header.username}`
      : data.header.displayName;
  const heroTextAlign = data.header.heroTextAlign ?? "center";
  const heroOverlay = data.header.heroOverlay ?? true;
  const heroOverlayStrength = data.header.heroOverlayStrength ?? 0.35;

  if (data.header.layout === "hero") {
    return (
      <div
        className="overflow-hidden rounded-3xl border border-white/15 shadow-xl"
        style={{ background: data.theme.cardBackground }}
      >
        <div className="relative h-44 w-full">
          <Image
            src={heroHeaderSrc}
            alt={data.header.displayName}
            className="h-full w-full object-cover"
            width={640}
            height={360}
            onError={onHeroImageError}
          />
          {heroOverlay ? (
            <div
              className="absolute inset-0"
              style={{ background: `rgba(2, 6, 23, ${heroOverlayStrength})` }}
            />
          ) : null}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 p-4",
              heroTextAlign === "left" ? "text-left" : "text-center",
            )}
          >
            <h2
              className="font-bold"
              style={{ color: titleColor, fontSize: `${titleSize}px`, lineHeight: 1.15 }}
            >
              {displayTitle}
            </h2>
            <p className="mt-1 text-sm" style={{ color: data.theme.mutedTextColor }}>
              @{data.header.username}
            </p>
            <p className="mt-1 text-xs font-medium opacity-90">{data.header.tagline}</p>
          </div>
        </div>
        <div
          className={cn(
            "space-y-2 p-4",
            heroTextAlign === "left" ? "text-left" : "text-center",
          )}
        >
          <p className="text-sm font-medium">{data.text.intro}</p>
          <p className="text-xs leading-5" style={{ color: data.theme.mutedTextColor }}>
            {data.text.body}
          </p>
        </div>
      </div>
    );
  }

  return (
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
        @{data.header.username}
      </p>
      <p className="mt-2 text-center text-xs font-medium opacity-90">{data.header.tagline}</p>
      <p className="mt-4 text-center text-sm font-medium">{data.text.intro}</p>
      <p className="mt-2 text-center text-xs leading-5" style={{ color: data.theme.mutedTextColor }}>
        {data.text.body}
      </p>
    </div>
  );
};
