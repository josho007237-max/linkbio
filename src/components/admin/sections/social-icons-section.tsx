"use client";

import { SafeImage } from "@/components/shared/safe-image";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Link2, MessageCircle, Music2, Plus, SquarePlay, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  getImageDataUrlByRef,
  isIndexedDbImageRef,
} from "@/lib/local-storage/image-storage";

const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube", "x", "facebook", "website"] as const;

const socialFallbackIconMap = {
  instagram: Link2,
  tiktok: Music2,
  youtube: SquarePlay,
  x: X,
  facebook: MessageCircle,
  website: Globe,
} as const;

const normalizeImageSrc = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
};

const normalizeIconImageUrlInput = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized || undefined;
};

export const SocialIconsSection = () => {
  const { t } = useI18n();
  const socials = useBuilderStore((state) => state.socials);
  const addSocial = useBuilderStore((state) => state.addSocial);
  const updateSocial = useBuilderStore((state) => state.updateSocial);
  const deleteSocial = useBuilderStore((state) => state.deleteSocial);

  const [openAdd, setOpenAdd] = useState(false);
  const [resolvedIcons, setResolvedIcons] = useState<Record<string, string>>({});

  const form = useForm<SocialFormValues>({
    resolver: zodResolver(socialSchema),
    defaultValues: {
      platform: "website",
      url: "https://",
      enabled: true,
      iconImageUrl: "",
      iconUrl: "",
    },
  });
  const formPlatform = useWatch({ control: form.control, name: "platform" });
  const formEnabled = useWatch({ control: form.control, name: "enabled" });
  const formIconUrl = useWatch({ control: form.control, name: "iconUrl" });

  useEffect(() => {
    const refs = socials
      .map((social) => social.iconUrl)
      .filter((value): value is string => isIndexedDbImageRef(value) && !resolvedIcons[value]);
    if (refs.length === 0) {
      return;
    }

    let canceled = false;
    void Promise.all(
      refs.map(async (ref) => ({ ref, resolved: await getImageDataUrlByRef(ref) })),
    ).then((results) => {
      if (canceled) {
        return;
      }
      const nextEntries = results.filter(
        (item): item is { ref: string; resolved: string } => Boolean(item.resolved),
      );
      if (nextEntries.length === 0) {
        return;
      }

      setResolvedIcons((current) => {
        const next = { ...current };
        for (const item of nextEntries) {
          next[item.ref] = item.resolved;
        }
        return next;
      });
    });

    return () => {
      canceled = true;
    };
  }, [resolvedIcons, socials]);

  const handleAdd = form.handleSubmit((values) => {
    addSocial({
      platform: values.platform,
      url: values.url,
      enabled: values.enabled,
      iconUrl: values.iconUrl,
      iconImageUrl: normalizeIconImageUrlInput(values.iconImageUrl ?? ""),
    });
    form.reset({ platform: "website", url: "https://", enabled: true, iconImageUrl: "", iconUrl: "" });
    setOpenAdd(false);
  });
  const urlError = form.formState.errors.url?.message;
  const iconImageUrlError = form.formState.errors.iconImageUrl?.message;

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
            const uploadedIconSrc = normalizeImageSrc(
              isIndexedDbImageRef(social.iconUrl) ? resolvedIcons[social.iconUrl] : social.iconUrl,
            );
            const previewIconSrc = normalizeImageSrc(social.iconImageUrl) || uploadedIconSrc;
            const FallbackIcon = socialFallbackIconMap[social.platform];
            const currentPreOpenModal = {
              enabled: social.preOpenModal?.enabled ?? false,
              title: social.preOpenModal?.title ?? "Notice",
              description: social.preOpenModal?.description ?? "",
              primaryButtonLabel: social.preOpenModal?.primaryButtonLabel ?? "Continue",
              destinationUrl: social.preOpenModal?.destinationUrl ?? "",
              showSecondaryButton: social.preOpenModal?.showSecondaryButton ?? true,
              secondaryButtonLabel: social.preOpenModal?.secondaryButtonLabel ?? "Close",
              dismissible: social.preOpenModal?.dismissible ?? true,
              buttonStyle: social.preOpenModal?.buttonStyle ?? ("solid" as const),
              bannerImageUrl: social.preOpenModal?.bannerImageUrl ?? "",
            };
            return (
              <div key={social.id} className="space-y-3 rounded-lg border border-border/70 bg-background/50 p-3">
                <div className="grid gap-2.5 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-center">
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
                  <Button variant="destructive" size="icon" onClick={() => deleteSocial(social.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t("social_icon_preview")}</span>
                    {previewIconSrc ? (
                      <span className="flex size-10 items-center justify-center rounded-md border bg-muted/30 p-1">
                        <SafeImage
                          src={previewIconSrc}
                          alt=""
                          width={32}
                          height={32}
                          className="max-h-full max-w-full object-contain"
                        />
                      </span>
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-md border bg-muted/30 p-1 text-muted-foreground">
                        <FallbackIcon className="size-4" />
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>{t("social_icon_image_url")}</Label>
                      <Input
                        type="url"
                        value={social.iconImageUrl ?? ""}
                        onChange={(event) =>
                          updateSocial(social.id, {
                            iconImageUrl: normalizeIconImageUrlInput(event.target.value),
                          })
                        }
                        placeholder="https://example.com/icon.png"
                      />
                    </div>
                    <CustomImageUpload
                      value={social.iconUrl}
                      preset="icon"
                      onValueChange={(nextValue) => updateSocial(social.id, { iconUrl: nextValue || undefined })}
                      className="w-full"
                      uploadLabel={t("social_icon_upload")}
                    />
                  </div>
                </div>
                <div className="space-y-2.5 rounded-lg border border-dashed p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={Boolean(social.preOpenModal?.enabled)}
                      onCheckedChange={(enabled) =>
                        updateSocial(social.id, {
                          preOpenModal: {
                            ...currentPreOpenModal,
                            enabled,
                          },
                        })
                      }
                    />
                    {t("pre_open_modal_enabled")}
                  </label>
                  {social.preOpenModal?.enabled ? (
                    <>
                      <div className="space-y-1">
                        <Label>{t("pre_open_modal_banner_image")}</Label>
                        <Input
                          value={social.preOpenModal?.bannerImageUrl ?? ""}
                          onChange={(event) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                bannerImageUrl: event.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <CustomImageUpload
                        value={social.preOpenModal?.bannerImageUrl}
                        preset="thumbnail_banner"
                        onValueChange={(nextValue) =>
                          updateSocial(social.id, {
                            preOpenModal: {
                              ...currentPreOpenModal,
                              bannerImageUrl: nextValue || "",
                            },
                          })
                        }
                        uploadLabel={t("pre_open_modal_banner_upload")}
                      />
                      <div className="space-y-1">
                        <Label>{t("pre_open_modal_title")}</Label>
                        <Input
                          value={social.preOpenModal?.title ?? ""}
                          onChange={(event) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                title: event.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("pre_open_modal_description")}</Label>
                        <Input
                          value={social.preOpenModal?.description ?? ""}
                          onChange={(event) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                description: event.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("pre_open_modal_primary_label")}</Label>
                        <Input
                          value={social.preOpenModal?.primaryButtonLabel ?? ""}
                          onChange={(event) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                primaryButtonLabel: event.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("pre_open_modal_destination_url")}</Label>
                        <Input
                          value={social.preOpenModal?.destinationUrl ?? ""}
                          onChange={(event) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                destinationUrl: event.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("pre_open_modal_button_style")}</Label>
                        <Select
                          value={social.preOpenModal?.buttonStyle ?? "solid"}
                          onValueChange={(buttonStyle) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                buttonStyle: buttonStyle as "solid" | "outline" | "glow",
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="solid">{t("pre_open_modal_button_style_solid")}</SelectItem>
                            <SelectItem value="outline">{t("pre_open_modal_button_style_outline")}</SelectItem>
                            <SelectItem value="glow">{t("pre_open_modal_button_style_glow")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={social.preOpenModal?.showSecondaryButton ?? true}
                          onCheckedChange={(showSecondaryButton) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                showSecondaryButton,
                              },
                            })
                          }
                        />
                        {t("pre_open_modal_show_secondary")}
                      </label>
                      {(social.preOpenModal?.showSecondaryButton ?? true) ? (
                        <div className="space-y-1">
                          <Label>{t("pre_open_modal_secondary_label")}</Label>
                          <Input
                            value={social.preOpenModal?.secondaryButtonLabel ?? ""}
                            onChange={(event) =>
                              updateSocial(social.id, {
                                preOpenModal: {
                                  ...currentPreOpenModal,
                                  secondaryButtonLabel: event.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ) : null}
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={social.preOpenModal?.dismissible ?? true}
                          onCheckedChange={(dismissible) =>
                            updateSocial(social.id, {
                              preOpenModal: {
                                ...currentPreOpenModal,
                                dismissible,
                              },
                            })
                          }
                        />
                        {t("pre_open_modal_dismissible")}
                      </label>
                    </>
                  ) : null}
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
        <form onSubmit={handleAdd} className="space-y-3.5 rounded-lg border border-border/70 bg-background/50 p-3.5">
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
            <Label>{t("social_icon_image_url")}</Label>
            <Input
              type="url"
              aria-invalid={Boolean(iconImageUrlError)}
              className={iconImageUrlError ? "border-destructive" : undefined}
              placeholder="https://example.com/icon.png"
              {...form.register("iconImageUrl")}
            />
            {iconImageUrlError ? <p className="text-xs text-destructive">{iconImageUrlError}</p> : null}
          </div>
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
          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
            <Button type="submit">{t("social_save")}</Button>
            <Button type="button" variant="outline" onClick={() => setOpenAdd(false)}>
              {t("social_cancel")}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
};

