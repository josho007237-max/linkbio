"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChangeEvent } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/section-card";
import { WallpaperFormValues, wallpaperSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { useI18n } from "@/i18n/use-i18n";
import { fileToDataUrl } from "@/lib/media/file-data-url";

export const WallpaperSection = () => {
  const { t } = useI18n();
  const theme = useBuilderStore((state) => state.theme);
  const updateTheme = useBuilderStore((state) => state.updateTheme);

  const form = useForm<WallpaperFormValues>({
    resolver: zodResolver(wallpaperSchema),
    mode: "onChange",
    defaultValues: {
      wallpaperUrl: theme.wallpaperUrl,
      pageBackground: theme.pageBackground,
      cardBackground: theme.cardBackground,
      textColor: theme.textColor,
      mutedTextColor: theme.mutedTextColor,
    },
  });
  const values = useWatch({ control: form.control });
  const wallpaperError = form.formState.errors.wallpaperUrl?.message;

  useEffect(() => {
    const parsed = wallpaperSchema.safeParse(values);
    if (parsed.success) {
      updateTheme(parsed.data);
    }
  }, [updateTheme, values]);

  const handleWallpaperUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      form.setValue("wallpaperUrl", dataUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <SectionCard
      id="wallpaper"
      title={t("wallpaper_title")}
      description={t("wallpaper_desc")}
    >
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
        <Input
          id="wallpaperUpload"
          type="file"
          accept="image/*"
          onChange={handleWallpaperUpload}
        />
        <p className="text-xs text-muted-foreground">
          {t("wallpaper_upload_help")}
        </p>
      </div>
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
    </SectionCard>
  );
};
