"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChangeEvent } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/section-card";
import { HeaderFormValues, headerSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { useI18n } from "@/i18n/use-i18n";
import { fileToDataUrl } from "@/lib/media/file-data-url";

type HeaderSectionProps = {
  slugCollisionWarning?: string | null;
};

export const HeaderSection = ({ slugCollisionWarning }: HeaderSectionProps) => {
  const { t } = useI18n();
  const header = useBuilderStore((state) => state.header);
  const updateHeader = useBuilderStore((state) => state.updateHeader);

  const form = useForm<HeaderFormValues>({
    resolver: zodResolver(headerSchema),
    mode: "onChange",
    defaultValues: {
      username: header.username,
      displayName: header.displayName,
      tagline: header.tagline,
      avatarUrl: header.avatarUrl,
    },
  });
  const values = useWatch({ control: form.control });
  const avatarError = form.formState.errors.avatarUrl?.message;

  useEffect(() => {
    const parsed = headerSchema.safeParse(values);
    if (parsed.success) {
      updateHeader(parsed.data);
    }
  }, [updateHeader, values]);

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      form.setValue("avatarUrl", dataUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <SectionCard
      id="header"
      title={t("header_title")}
      description={t("header_desc")}
    >
      <div className="space-y-2">
        <Label htmlFor="username">{t("header_username")}</Label>
        <Input
          id="username"
          aria-invalid={Boolean(slugCollisionWarning)}
          className={slugCollisionWarning ? "border-amber-500 ring-amber-500/30" : undefined}
          {...form.register("username")}
        />
        {slugCollisionWarning ? (
          <p className="text-xs text-amber-600">
            {t("header_slug_collision")}
          </p>
        ) : null}
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
      <div className="space-y-2">
        <Label htmlFor="avatarUpload">{t("header_upload_avatar")}</Label>
        <Input id="avatarUpload" type="file" accept="image/*" onChange={handleAvatarUpload} />
        <p className="text-xs text-muted-foreground">{t("header_upload_help")}</p>
      </div>
    </SectionCard>
  );
};
