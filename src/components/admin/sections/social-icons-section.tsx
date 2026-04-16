"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { SectionCard } from "@/components/admin/section-card";
import { CustomImageUpload } from "@/components/admin/shared/custom-image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SocialFormValues, socialSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { useI18n } from "@/i18n/use-i18n";

const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube", "x", "facebook", "website"] as const;

const normalizeImageSrc = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
};

export const SocialIconsSection = () => {
  const { t } = useI18n();
  const socials = useBuilderStore((state) => state.socials);
  const addSocial = useBuilderStore((state) => state.addSocial);
  const updateSocial = useBuilderStore((state) => state.updateSocial);
  const deleteSocial = useBuilderStore((state) => state.deleteSocial);

  const [openAdd, setOpenAdd] = useState(false);

  const form = useForm<SocialFormValues>({
    resolver: zodResolver(socialSchema),
    defaultValues: {
      platform: "website",
      url: "https://",
      enabled: true,
      iconUrl: "",
    },
  });
  const formPlatform = useWatch({ control: form.control, name: "platform" });
  const formEnabled = useWatch({ control: form.control, name: "enabled" });
  const formIconUrl = useWatch({ control: form.control, name: "iconUrl" });

  const handleAdd = form.handleSubmit((values) => {
    addSocial(values);
    form.reset({ platform: "website", url: "https://", enabled: true, iconUrl: "" });
    setOpenAdd(false);
  });
  const urlError = form.formState.errors.url?.message;

  return (
    <SectionCard
      id="social-icons"
      title={t("social_title")}
      description={t("social_desc")}
    >
      <div className="space-y-3">
        {socials.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t("social_empty")}
          </div>
        ) : (
          socials.map((social) => {
            const parsed = socialSchema.shape.url.safeParse(social.url);
            return (
              <div key={social.id} className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-center">
                  <Select
                    value={social.platform}
                    onValueChange={(value) => updateSocial(social.id, { platform: value as SocialFormValues["platform"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="url"
                    aria-invalid={!parsed.success}
                    className={!parsed.success ? "border-destructive" : undefined}
                    value={social.url}
                    onChange={(event) => updateSocial(social.id, { url: event.target.value })}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={social.enabled}
                      onCheckedChange={(enabled) => updateSocial(social.id, { enabled })}
                    />
                    {t("social_enabled")}
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => deleteSocial(social.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t("social_icon_preview")}</span>
                    {normalizeImageSrc(social.iconUrl) ? (
                      <Image
                        src={normalizeImageSrc(social.iconUrl) as string}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6 rounded object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                  <CustomImageUpload
                    value={social.iconUrl}
                    preset="icon"
                    onValueChange={(nextValue) => updateSocial(social.id, { iconUrl: nextValue || undefined })}
                    className="w-full"
                    uploadLabel={t("social_icon_upload")}
                  />
                </div>
                {!parsed.success ? (
                  <p className="text-xs text-destructive">{t("social_invalid_url")}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {!openAdd ? (
        <Button variant="secondary" onClick={() => setOpenAdd(true)}>
          <Plus className="size-4" />
          {t("social_add")}
        </Button>
      ) : (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border p-3">
          <div className="space-y-2">
            <Label>{t("social_platform")}</Label>
            <Select value={formPlatform} onValueChange={(value) => form.setValue("platform", value as SocialFormValues["platform"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("social_url")}</Label>
            <Input
              type="url"
              aria-invalid={Boolean(urlError)}
              className={urlError ? "border-destructive" : undefined}
              {...form.register("url")}
            />
            {urlError ? <p className="text-xs text-destructive">{urlError}</p> : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={formEnabled} onCheckedChange={(v) => form.setValue("enabled", v)} />
            {t("social_enabled")}
          </label>
          <div className="space-y-2">
            <Label>{t("social_icon_upload")}</Label>
            <CustomImageUpload
              value={formIconUrl}
              preset="icon"
              onValueChange={(nextValue) =>
                form.setValue("iconUrl", nextValue, { shouldDirty: true, shouldValidate: true })
              }
              uploadLabel={t("social_icon_upload")}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit">{t("social_save")}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpenAdd(false)}>
              {t("social_cancel")}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
};
