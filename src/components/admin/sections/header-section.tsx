"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CustomImageUpload } from "@/components/admin/shared/custom-image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/admin/section-card";
import { headerSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { useI18n } from "@/i18n/use-i18n";

type HeaderSectionProps = {
  slugCollisionWarning?: string | null;
};

export const HeaderSection = ({ slugCollisionWarning }: HeaderSectionProps) => {
  const { t } = useI18n();
  const header = useBuilderStore((state) => state.header);
  const theme = useBuilderStore((state) => state.theme);
  const updateHeader = useBuilderStore((state) => state.updateHeader);
  const updateTheme = useBuilderStore((state) => state.updateTheme);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const form = useForm<z.input<typeof headerSchema>>({
    resolver: zodResolver(headerSchema),
    mode: "onChange",
    defaultValues: {
      username: header.username,
      publicHandle: header.publicHandle ?? header.publicUsername ?? header.username,
      displayName: header.displayName,
      tagline: header.tagline,
      shareTitle: header.shareTitle ?? "",
      shareDescription: header.shareDescription ?? "",
      shareImageUrl: header.shareImageUrl ?? "",
      avatarUrl: header.avatarUrl,
      heroImageUrl: header.heroImageUrl ?? "/placeholders/wallpaper-default.svg",
      layout: header.layout ?? "classic",
      titleMode: header.titleMode ?? "display_name",
      heroTextAlign: header.heroTextAlign ?? "center",
      heroOverlay: header.heroOverlay ?? true,
      heroOverlayStrength: header.heroOverlayStrength ?? 0.35,
      matchThemeToHero: header.matchThemeToHero ?? false,
    },
  });
  const values = useWatch({ control: form.control });
  const layout = useWatch({ control: form.control, name: "layout" });
  const titleMode = useWatch({ control: form.control, name: "titleMode" });
  const avatarUrl = useWatch({ control: form.control, name: "avatarUrl" });
  const heroImageUrl = useWatch({ control: form.control, name: "heroImageUrl" });
  const heroTextAlign = useWatch({ control: form.control, name: "heroTextAlign" });
  const heroOverlay = useWatch({ control: form.control, name: "heroOverlay" });
  const heroOverlayStrength = useWatch({
    control: form.control,
    name: "heroOverlayStrength",
  });
  const matchThemeToHero = useWatch({ control: form.control, name: "matchThemeToHero" });
  void slugCollisionWarning;
  const avatarError = form.formState.errors.avatarUrl?.message;
  const heroImageError = form.formState.errors.heroImageUrl?.message;

  useEffect(() => {
    const parsed = headerSchema.safeParse(values);
    if (parsed.success) {
      updateHeader(parsed.data);
    }
  }, [updateHeader, values]);

  useEffect(() => {
    if (
      layout !== "hero" ||
      !matchThemeToHero ||
      typeof window === "undefined" ||
      !heroImageUrl
    ) {
      return;
    }

    let canceled = false;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (canceled) {
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }
        canvas.width = 32;
        canvas.height = 18;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3];
          if (alpha < 20) {
            continue;
          }
          red += pixels[index];
          green += pixels[index + 1];
          blue += pixels[index + 2];
          count += 1;
        }

        if (count === 0) {
          return;
        }

        const avgRed = Math.round(red / count);
        const avgGreen = Math.round(green / count);
        const avgBlue = Math.round(blue / count);
        const luminance = 0.2126 * avgRed + 0.7152 * avgGreen + 0.0722 * avgBlue;
        const textColor = luminance < 145 ? "#F8FAFC" : "#0F172A";
        const mutedTextColor = luminance < 145 ? "#CBD5E1" : "#475569";
        const pageBackground = `rgb(${Math.max(0, avgRed - 22)}, ${Math.max(
          0,
          avgGreen - 22,
        )}, ${Math.max(0, avgBlue - 22)})`;
        const cardBackground =
          luminance < 145 ? "rgba(15, 23, 42, 0.62)" : "rgba(255, 255, 255, 0.66)";

        updateTheme({
          pageBackground,
          cardBackground,
          textColor,
          mutedTextColor,
          titleColor: textColor,
        });
      } catch {
        return;
      }
    };
    image.src = heroImageUrl;

    return () => {
      canceled = true;
    };
  }, [heroImageUrl, layout, matchThemeToHero, updateTheme]);

  return (
    <SectionCard
      id="header"
      title={t("header_title")}
      description={t("header_desc")}
    >
      <div className="space-y-2">
        <Label htmlFor="workspaceSlug">{t("saved_manager_create_slug")}</Label>
        <Input
          id="workspaceSlug"
          value={header.username}
          readOnly
        />
        <input type="hidden" {...form.register("username")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="publicHandle">{t("header_username")}</Label>
        <Input id="publicHandle" {...form.register("publicHandle")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">{t("header_display_name")}</Label>
        <Input id="displayName" {...form.register("displayName")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tagline">{t("header_tagline")}</Label>
        <Input id="tagline" {...form.register("tagline")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shareTitle">{t("header_share_title")}</Label>
        <Input id="shareTitle" {...form.register("shareTitle")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shareDescription">{t("header_share_description")}</Label>
        <Textarea id="shareDescription" rows={3} {...form.register("shareDescription")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shareImageUrl">{t("header_share_image_url")}</Label>
        <Input
          id="shareImageUrl"
          type="text"
          placeholder="https://... or /placeholders/wallpaper-default.svg"
          {...form.register("shareImageUrl")}
        />
      </div>
      {layout === "classic" ? (
        <div className="space-y-2">
          <Label htmlFor="avatarUrl">{t("header_avatar_url")}</Label>
          <Input
            id="avatarUrl"
            type="text"
            placeholder="https://... or /placeholders/avatar-default.svg"
            aria-invalid={Boolean(avatarError)}
            className={avatarError ? "border-destructive" : undefined}
            {...form.register("avatarUrl")}
          />
          {avatarError ? <p className="text-xs text-destructive">{avatarError}</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="heroImageUrl">{t("header_hero_image_url")}</Label>
          <Input
            id="heroImageUrl"
            type="text"
            placeholder="https://... or /placeholders/wallpaper-default.svg"
            aria-invalid={Boolean(heroImageError)}
            className={heroImageError ? "border-destructive" : undefined}
            {...form.register("heroImageUrl")}
          />
          {heroImageError ? <p className="text-xs text-destructive">{heroImageError}</p> : null}
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("header_layout_mode")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-sm ${layout === "classic" ? "bg-muted font-medium ring-1 ring-primary/30" : ""}`}
            onClick={() => form.setValue("layout", "classic", { shouldDirty: true, shouldValidate: true })}
          >
            {t("header_layout_classic")}
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-sm ${layout === "hero" ? "bg-muted font-medium ring-1 ring-primary/30" : ""}`}
            onClick={() => form.setValue("layout", "hero", { shouldDirty: true, shouldValidate: true })}
          >
            {t("header_layout_hero")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {layout === "hero"
            ? t("header_hero_description")
            : t("header_classic_description")}
        </p>
        {layout === "hero" ? (
          <p className="text-xs text-muted-foreground">{t("header_missing_hero_fallback")}</p>
        ) : null}
      </div>
      {layout === "classic" ? (
        <div className="space-y-2">
          <Label htmlFor="avatarUpload">{t("header_upload_avatar")}</Label>
          <CustomImageUpload
            value={avatarUrl}
            preset="avatar_hero"
            onValueChange={(nextValue) =>
              form.setValue("avatarUrl", nextValue, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onError={(message) => setUploadWarning(message)}
          />
          {uploadWarning ? <p className="text-xs text-amber-600">{uploadWarning}</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="heroUpload">{t("header_upload_hero")}</Label>
          <CustomImageUpload
            value={heroImageUrl}
            preset="thumbnail_banner"
            onValueChange={(nextValue) =>
              form.setValue("heroImageUrl", nextValue, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onError={(message) => setUploadWarning(message)}
          />
          {uploadWarning ? <p className="text-xs text-amber-600">{uploadWarning}</p> : null}
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("header_title_mode")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-sm ${titleMode === "display_name" ? "bg-muted font-medium ring-1 ring-primary/30" : ""}`}
            onClick={() =>
              form.setValue("titleMode", "display_name", {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            {t("header_title_mode_name")}
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-sm ${titleMode === "username" ? "bg-muted font-medium ring-1 ring-primary/30" : ""}`}
            onClick={() =>
              form.setValue("titleMode", "username", {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            {t("header_title_mode_username")}
          </button>
        </div>
      </div>
      {layout === "hero" ? (
        <>
          <div className="space-y-2">
            <Label>{t("header_hero_text_align")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm ${heroTextAlign === "left" ? "bg-muted font-medium ring-1 ring-primary/30" : ""}`}
                onClick={() =>
                  form.setValue("heroTextAlign", "left", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {t("header_hero_text_align_left")}
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm ${heroTextAlign === "center" ? "bg-muted font-medium ring-1 ring-primary/30" : ""}`}
                onClick={() =>
                  form.setValue("heroTextAlign", "center", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {t("header_hero_text_align_center")}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={heroOverlay}
              onChange={(event) =>
                form.setValue("heroOverlay", event.target.checked, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            {t("header_hero_overlay")}
          </label>
          <div className="space-y-2">
            <Label htmlFor="heroOverlayStrength">{t("header_hero_overlay_strength")}</Label>
            <Input
              id="heroOverlayStrength"
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={heroOverlayStrength}
              onChange={(event) =>
                form.setValue("heroOverlayStrength", Number(event.target.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {Math.round((heroOverlayStrength ?? 0) * 100)}%
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={matchThemeToHero}
              onChange={(event) =>
                form.setValue("matchThemeToHero", event.target.checked, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            {t("header_match_theme_to_hero")}
          </label>
        </>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="headerTitleColor">{t("header_title_color")}</Label>
        <Input
          id="headerTitleColor"
          value={theme.titleColor ?? theme.textColor}
          onChange={(event) => updateTheme({ titleColor: event.target.value })}
        />
      </div>
    </SectionCard>
  );
};
