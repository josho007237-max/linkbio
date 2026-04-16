"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { CustomImageUpload } from "@/components/admin/shared/custom-image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/section-card";
import { WallpaperFormValues, wallpaperSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { useI18n } from "@/i18n/use-i18n";

const CURATED_THEMES = [
  { name: "midnight" as const, pageBackground: "#0B1222", cardBackground: "rgba(17,25,40,0.85)", textColor: "#F4F7FF", mutedTextColor: "#B8C2DB", buttonBackground: "#2563EB", buttonTextColor: "#EFF6FF", titleColor: "#F4F7FF" },
  { name: "sunset" as const, pageBackground: "#2D1227", cardBackground: "rgba(53,22,48,0.82)", textColor: "#FFF4F4", mutedTextColor: "#F4C8D8", buttonBackground: "#F43F5E", buttonTextColor: "#FFF1F2", titleColor: "#FFDCE5" },
  { name: "forest" as const, pageBackground: "#0D1F1A", cardBackground: "rgba(19,39,31,0.84)", textColor: "#ECFDF5", mutedTextColor: "#BBE8D7", buttonBackground: "#10B981", buttonTextColor: "#ECFDF5", titleColor: "#D1FAE5" },
];

export const WallpaperSection = () => {
  const { t } = useI18n();
  const theme = useBuilderStore((state) => state.theme);
  const updateTheme = useBuilderStore((state) => state.updateTheme);
  const [themeTab, setThemeTab] = useState<"customizable" | "curated">("customizable");
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const form = useForm<WallpaperFormValues>({
    resolver: zodResolver(wallpaperSchema),
    mode: "onChange",
    defaultValues: {
      wallpaperUrl: theme.wallpaperUrl,
      wallpaperVideoUrl: theme.wallpaperVideoUrl ?? "",
      wallpaperStyle: theme.wallpaperStyle ?? "image",
      pageBackground: theme.pageBackground,
      cardBackground: theme.cardBackground,
      textColor: theme.textColor,
      mutedTextColor: theme.mutedTextColor,
      titleColor: theme.titleColor ?? theme.textColor,
      titleSize: theme.titleSize ?? 28,
      pageFont: theme.pageFont ?? "inter",
    },
  });
  const values = useWatch({ control: form.control });
  const wallpaperStyle = useWatch({ control: form.control, name: "wallpaperStyle" });
  const wallpaperUrl = useWatch({ control: form.control, name: "wallpaperUrl" });
  const textColor = useWatch({ control: form.control, name: "textColor" });
  const wallpaperError = form.formState.errors.wallpaperUrl?.message;

  useEffect(() => {
    const parsed = wallpaperSchema.safeParse(values);
    if (parsed.success) {
      updateTheme(parsed.data);
    }
  }, [updateTheme, values]);

  return (
    <SectionCard
      id="wallpaper"
      title={t("wallpaper_title")}
      description={t("wallpaper_desc")}
    >
      <div className="space-y-2">
        <Label>{t("theme_title")}</Label>
        <div className="inline-flex rounded-md border bg-muted/30 p-1">
          <button
            type="button"
            className={`rounded px-3 py-1 text-xs ${themeTab === "customizable" ? "bg-background shadow-sm" : ""}`}
            onClick={() => setThemeTab("customizable")}
          >
            {t("theme_tab_customizable")}
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-xs ${themeTab === "curated" ? "bg-background shadow-sm" : ""}`}
            onClick={() => setThemeTab("curated")}
          >
            {t("theme_tab_curated")}
          </button>
        </div>
        {themeTab === "curated" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {CURATED_THEMES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={`rounded-lg border p-2 text-left ${theme.name === preset.name ? "ring-1 ring-primary" : ""}`}
                onClick={() =>
                  updateTheme({
                    name: preset.name,
                    pageBackground: preset.pageBackground,
                    cardBackground: preset.cardBackground,
                    textColor: preset.textColor,
                    mutedTextColor: preset.mutedTextColor,
                    buttonBackground: preset.buttonBackground,
                    buttonTextColor: preset.buttonTextColor,
                    titleColor: preset.titleColor,
                  })
                }
              >
                <div className="h-10 rounded-md" style={{ background: `linear-gradient(135deg, ${preset.pageBackground}, ${preset.buttonBackground})` }} />
                <p className="mt-2 text-xs font-medium capitalize">{preset.name}</p>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="wallpaperUrl">{t("wallpaper_url")}</Label>
        <Input
          id="wallpaperUrl"
          type="text"
          placeholder="https://... or /placeholders/wallpaper-default.svg"
          aria-invalid={Boolean(wallpaperError)}
          className={wallpaperError ? "border-destructive" : undefined}
          {...form.register("wallpaperUrl")}
        />
        {wallpaperError ? (
          <p className="text-xs text-destructive">{wallpaperError}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="wallpaperUpload">{t("wallpaper_upload")}</Label>
        <CustomImageUpload
          value={wallpaperUrl}
          preset="thumbnail_banner"
          onValueChange={(nextValue) =>
            form.setValue("wallpaperUrl", nextValue, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          onError={(message) => setUploadWarning(message)}
        />
      </div>
      {uploadWarning ? <p className="text-xs text-amber-600">{uploadWarning}</p> : null}
      <div className="space-y-2">
        <Label>{t("wallpaper_style_title")}</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["fill", t("wallpaper_style_fill")],
            ["gradient", t("wallpaper_style_gradient")],
            ["blur", t("wallpaper_style_blur")],
            ["pattern", t("wallpaper_style_pattern")],
            ["image", t("wallpaper_style_image")],
            ["video", t("wallpaper_style_video")],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-md border px-3 py-2 text-xs ${
                wallpaperStyle === value ? "bg-muted font-medium ring-1 ring-primary/30" : ""
              }`}
              onClick={() =>
                form.setValue("wallpaperStyle", value as WallpaperFormValues["wallpaperStyle"], {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {wallpaperStyle === "video" ? (
        <div className="space-y-2">
          <Label htmlFor="wallpaperVideoUrl">{t("wallpaper_video_url")}</Label>
          <Input id="wallpaperVideoUrl" {...form.register("wallpaperVideoUrl")} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pageBackground">{t("wallpaper_page_bg")}</Label>
          <Input id="pageBackground" {...form.register("pageBackground")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cardBackground">{t("wallpaper_card_bg")}</Label>
          <Input id="cardBackground" {...form.register("cardBackground")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="textColor">{t("wallpaper_text_color")}</Label>
          <Input id="textColor" {...form.register("textColor")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mutedTextColor">{t("wallpaper_muted_text_color")}</Label>
          <Input id="mutedTextColor" {...form.register("mutedTextColor")} />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <p className="text-sm font-medium">{t("colors_title")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="titleColor">{t("colors_title_color")}</Label>
            <Input id="titleColor" {...form.register("titleColor")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buttonColor">{t("colors_button")}</Label>
            <Input
              id="buttonColor"
              value={theme.buttonBackground}
              onChange={(event) => updateTheme({ buttonBackground: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buttonTextColor">{t("buttons_text_color")}</Label>
            <Input
              id="buttonTextColor"
              value={theme.buttonTextColor}
              onChange={(event) => updateTheme({ buttonTextColor: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="textColor">{t("colors_text")}</Label>
            <Input
              id="textColor"
              value={textColor}
              onChange={(event) =>
                form.setValue("textColor", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
