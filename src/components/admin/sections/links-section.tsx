"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Settings2,
  SquarePen,
  Trash2,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { SectionCard } from "@/components/admin/section-card";
import { CustomImageUpload } from "@/components/admin/shared/custom-image-upload";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  LinkFormValues,
  LinkSettingsFormValues,
  linkSchema,
  linkSettingsSchema,
} from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { BioLink } from "@/features/builder/types";
import {
  createEmptyDiscountCode,
  createEmptyEmbedPost,
  createEmptyLink,
  getContentType,
  getDiscountData,
  getEmbedPostData,
} from "@/features/builder/utils";
import { useI18n } from "@/i18n/use-i18n";
import { getPerLinkClickCounts } from "@/lib/local-storage/analytics-storage";
import { toProfileSlug } from "@/lib/local-storage/profile-storage";
import { cn } from "@/lib/utils";

type SortableLinkItemProps = {
  link: BioLink;
  clickCount: number;
  labels: {
    clicks: string;
    enabled: string;
    invalidUrl: string;
    discountType: string;
    embedType: string;
    layoutClassic: string;
    layoutFeatured: string;
  };
  onEdit: (id: string) => void;
  onOpenSettings: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
};

type StaticLinkItemProps = SortableLinkItemProps;

const LinkItemContent = ({
  link,
  clickCount,
  labels,
  onEdit,
  onOpenSettings,
  onDelete,
  onToggle,
  dragHandle,
}: StaticLinkItemProps & { dragHandle: ReactNode }) => {
  const isDiscount = getContentType(link) === "discount";
  const isEmbedPost = getContentType(link) === "embed_post";
  const discount = isDiscount ? getDiscountData(link) : null;
  const embedPost = isEmbedPost ? getEmbedPostData(link) : null;
  const displayTitle = isDiscount
    ? discount?.cardTitle || link.title
    : isEmbedPost
      ? embedPost?.cardTitle || link.title
      : link.title;
  const displayUrl = isDiscount
    ? discount?.destinationUrl || link.url
    : isEmbedPost
      ? embedPost?.ctaUrl || link.url
      : link.url;
  const isInvalidUrl = !linkSchema.shape.url.safeParse(displayUrl).success;

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto_auto_auto] sm:items-center">
        {dragHandle}
        <div>
          <p className="text-sm font-semibold">{displayTitle}</p>
          {isDiscount || isEmbedPost ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-amber-700">
              {isDiscount ? labels.discountType : labels.embedType} ·{" "}
              {(isDiscount ? discount?.layout : embedPost?.layout) === "featured"
                ? labels.layoutFeatured
                : labels.layoutClassic}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{displayUrl}</p>
          <p className="text-xs text-muted-foreground">{labels.clicks}: {clickCount}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={link.enabled} onCheckedChange={(v) => onToggle(link.id, v)} />
          {labels.enabled}
        </label>
        <Button variant="ghost" size="icon" onClick={() => onEdit(link.id)}>
          <SquarePen className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onOpenSettings(link.id)}>
          <Settings2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(link.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {isInvalidUrl ? (
        <p className="text-xs text-destructive">{labels.invalidUrl}</p>
      ) : null}
    </div>
  );
};

const SortableLinkItem = ({
  link,
  clickCount,
  labels,
  onEdit,
  onOpenSettings,
  onDelete,
  onToggle,
}: SortableLinkItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-70")}>
      <LinkItemContent
        link={link}
        clickCount={clickCount}
        labels={labels}
        onEdit={onEdit}
        onOpenSettings={onOpenSettings}
        onDelete={onDelete}
        onToggle={onToggle}
        dragHandle={
          <button
            className="cursor-grab rounded-md border p-2 text-muted-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
};

const StaticLinkItem = ({
  link,
  clickCount,
  labels,
  onEdit,
  onOpenSettings,
  onDelete,
  onToggle,
}: StaticLinkItemProps) => (
  <LinkItemContent
    link={link}
    clickCount={clickCount}
    labels={labels}
    onEdit={onEdit}
    onOpenSettings={onOpenSettings}
    onDelete={onDelete}
    onToggle={onToggle}
    dragHandle={
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-md border p-2 text-muted-foreground/60"
      >
        <GripVertical className="size-4" />
      </button>
    }
  />
);

export const LinksSection = () => {
  const { t } = useI18n();
  const links = useBuilderStore((state) => state.links);
  const username = useBuilderStore((state) => state.header.username);
  const addLink = useBuilderStore((state) => state.addLink);
  const updateLink = useBuilderStore((state) => state.updateLink);
  const updateLinkSettings = useBuilderStore((state) => state.updateLinkSettings);
  const deleteLink = useBuilderStore((state) => state.deleteLink);
  const reorderLinks = useBuilderStore((state) => state.reorderLinks);
  const toggleLink = useBuilderStore((state) => state.toggleLink);

  const [editId, setEditId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<"link" | "layout">("link");

  const editingLink = useMemo(
    () => links.find((link) => link.id === editId) ?? null,
    [editId, links],
  );
  const settingsLink = useMemo(
    () => links.find((link) => link.id === settingsId) ?? null,
    [links, settingsId],
  );

  const editForm = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      contentType: "link",
      title: "",
      url: "https://example.com",
      description: "",
      enabled: true,
      cardTitle: "",
      cardThumbnail: "",
      layout: "classic",
      modalTitle: "",
      modalHeroImage: "",
      modalDescription: "",
      discountCode: "",
      copyButtonLabel: "",
      ctaButtonLabel: "",
      destinationUrl: "https://example.com",
      dismissible: true,
      embedProvider: "youtube",
      embedCardTitle: "",
      embedCardIcon: "",
      embedCardThumbnail: "",
      embedLayout: "classic",
      embedModalTitle: "",
      embedMode: "url",
      embedSourceUrl: "",
      embedCode: "",
      embedDescription: "",
      embedCtaButtonLabel: "",
      embedCtaUrl: "https://example.com",
      embedDismissible: true,
    },
  });

  const settingsForm = useForm<LinkSettingsFormValues>({
    resolver: zodResolver(linkSettingsSchema),
    defaultValues: {
      thumbnailUrl: "",
      prioritize: false,
      startAt: "",
      endAt: "",
      locked: false,
      lockMessage: "",
    },
  });
  const editEnabled = useWatch({ control: editForm.control, name: "enabled" });
  const editContentType = useWatch({ control: editForm.control, name: "contentType" });
  const editModalHeroImage = useWatch({ control: editForm.control, name: "modalHeroImage" });
  const editCardThumbnail = useWatch({ control: editForm.control, name: "cardThumbnail" });
  const editEmbedCardIcon = useWatch({ control: editForm.control, name: "embedCardIcon" });
  const editEmbedCardThumbnail = useWatch({
    control: editForm.control,
    name: "embedCardThumbnail",
  });
  const editDismissible = useWatch({ control: editForm.control, name: "dismissible" });
  const editEmbedProvider = useWatch({ control: editForm.control, name: "embedProvider" });
  const editEmbedMode = useWatch({ control: editForm.control, name: "embedMode" });
  const editEmbedDismissible = useWatch({
    control: editForm.control,
    name: "embedDismissible",
  });
  const settingsThumbnailUrl = useWatch({
    control: settingsForm.control,
    name: "thumbnailUrl",
  });
  const prioritize = useWatch({ control: settingsForm.control, name: "prioritize" });
  const locked = useWatch({ control: settingsForm.control, name: "locked" });
  const editUrlError = editForm.formState.errors.url?.message;
  const editTitleError = editForm.formState.errors.title?.message;
  const editCardTitleError = editForm.formState.errors.cardTitle?.message;
  const editDiscountCodeError = editForm.formState.errors.discountCode?.message;
  const editCopyButtonLabelError = editForm.formState.errors.copyButtonLabel?.message;
  const editCtaButtonLabelError = editForm.formState.errors.ctaButtonLabel?.message;
  const editModalTitleError = editForm.formState.errors.modalTitle?.message;
  const editDestinationUrlError = editForm.formState.errors.destinationUrl?.message;
  const editLayoutError = editForm.formState.errors.layout?.message;
  const editCardThumbnailError = editForm.formState.errors.cardThumbnail?.message;
  const editModalHeroImageError = editForm.formState.errors.modalHeroImage?.message;
  const editEmbedProviderError = editForm.formState.errors.embedProvider?.message;
  const editEmbedModeError = editForm.formState.errors.embedMode?.message;
  const editEmbedSourceUrlError = editForm.formState.errors.embedSourceUrl?.message;
  const editEmbedCodeError = editForm.formState.errors.embedCode?.message;
  const editEmbedCardTitleError = editForm.formState.errors.embedCardTitle?.message;
  const editEmbedModalTitleError = editForm.formState.errors.embedModalTitle?.message;
  const editEmbedCtaLabelError = editForm.formState.errors.embedCtaButtonLabel?.message;
  const editEmbedCtaUrlError = editForm.formState.errors.embedCtaUrl?.message;
  const editEmbedCardThumbError = editForm.formState.errors.embedCardThumbnail?.message;
  const editEmbedCardIconError = editForm.formState.errors.embedCardIcon?.message;
  const editEmbedLayoutError = editForm.formState.errors.embedLayout?.message;
  const editLayoutErrorText = editContentType === "discount" ? editLayoutError : editEmbedLayoutError;
  const settingsThumbnailError =
    settingsForm.formState.errors.thumbnailUrl?.message;
  const discountCodeErrorText = editDiscountCodeError
    ? t("discount_empty_code_message")
    : null;
  const destinationUrlErrorText = editDestinationUrlError
    ? t("discount_invalid_url_message")
    : null;
  const slug = useMemo(() => toProfileSlug(username), [username]);
  const [isDndMounted, setIsDndMounted] = useState(false);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsDndMounted(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const onStorage = () => setAnalyticsRefreshKey((value) => value + 1);
    window.addEventListener("storage", onStorage);
    const intervalId = window.setInterval(onStorage, 3000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  const perLinkClickCounts = useMemo(() => {
    if (!isDndMounted) {
      return {};
    }
    void analyticsRefreshKey;
    return getPerLinkClickCounts(slug);
  }, [analyticsRefreshKey, isDndMounted, slug]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const labels = useMemo(
    () => ({
      clicks: t("links_clicks"),
      enabled: t("links_enabled"),
      invalidUrl: t("links_invalid_url"),
      discountType: t("links_type_discount"),
      embedType: t("links_type_embed_post"),
      layoutClassic: t("links_layout_classic"),
      layoutFeatured: t("links_layout_featured"),
    }),
    [t],
  );

  const openEdit = (id: string) => {
    const link = links.find((item) => item.id === id);
    if (!link) {
      return;
    }
    const discount = getDiscountData(link);
    const embedPost = getEmbedPostData(link);
    const isDiscount = getContentType(link) === "discount";
    const isEmbedPost = getContentType(link) === "embed_post";
    editForm.reset({
      contentType: getContentType(link),
      title: isDiscount ? discount.cardTitle : isEmbedPost ? embedPost.cardTitle : link.title,
      url: isDiscount ? discount.destinationUrl : isEmbedPost ? embedPost.ctaUrl : link.url,
      description: isDiscount
        ? discount.modalDescription
        : isEmbedPost
          ? embedPost.description
          : link.description ?? "",
      enabled: link.enabled,
      cardTitle: discount.cardTitle,
      cardThumbnail: discount.cardThumbnail ?? "",
      layout: discount.layout,
      modalTitle: discount.modalTitle,
      modalHeroImage: discount.modalHeroImage ?? "",
      modalDescription: discount.modalDescription,
      discountCode: discount.discountCode,
      copyButtonLabel: discount.copyButtonLabel,
      ctaButtonLabel: discount.ctaButtonLabel,
      destinationUrl: discount.destinationUrl,
      dismissible: discount.dismissible,
      embedProvider: embedPost.provider,
      embedCardTitle: embedPost.cardTitle,
      embedCardIcon: embedPost.cardIcon,
      embedCardThumbnail: embedPost.cardThumbnail,
      embedLayout: embedPost.layout,
      embedModalTitle: embedPost.modalTitle,
      embedMode: embedPost.embedMode,
      embedSourceUrl: embedPost.sourceUrl,
      embedCode: embedPost.embedCode,
      embedDescription: embedPost.description,
      embedCtaButtonLabel: embedPost.ctaButtonLabel,
      embedCtaUrl: embedPost.ctaUrl,
      embedDismissible: embedPost.dismissible,
    });
    setEditTab("link");
    setEditId(id);
  };

  const openSettings = (id: string) => {
    const link = links.find((item) => item.id === id);
    if (!link) {
      return;
    }
    settingsForm.reset({
      thumbnailUrl: link.settings.thumbnailUrl ?? "",
      prioritize: link.settings.prioritize,
      startAt: link.settings.schedule?.startAt ?? "",
      endAt: link.settings.schedule?.endAt ?? "",
      locked: link.settings.locked,
      lockMessage: link.settings.lockMessage ?? "",
    });
    setSettingsId(id);
  };

  const saveEdit = editForm.handleSubmit((values) => {
    if (!editId) {
      return;
    }
    updateLink(editId, {
      contentType: values.contentType,
      title:
        values.contentType === "discount"
          ? values.cardTitle ?? ""
          : values.contentType === "embed_post"
            ? values.embedCardTitle ?? ""
            : values.title,
      url:
        values.contentType === "discount"
          ? values.destinationUrl ?? ""
          : values.contentType === "embed_post"
            ? values.embedCtaUrl ?? ""
            : values.url,
      description:
        values.contentType === "discount"
          ? values.modalDescription
          : values.contentType === "embed_post"
            ? values.embedDescription
            : values.description,
      enabled: values.enabled,
      discount:
        values.contentType === "discount"
          ? {
              type: "discount_code",
              cardTitle: values.cardTitle ?? "",
              cardThumbnail: values.cardThumbnail ?? "",
              layout: values.layout ?? "classic",
              modalTitle: values.modalTitle ?? "",
              modalHeroImage: values.modalHeroImage ?? "",
              modalDescription: values.modalDescription ?? "",
              discountCode: values.discountCode ?? "",
              copyButtonLabel: values.copyButtonLabel ?? "",
              ctaButtonLabel: values.ctaButtonLabel ?? "",
              destinationUrl: values.destinationUrl ?? "",
              dismissible: values.dismissible ?? true,
              codeLock: {
                enabled: false,
              },
              analyticsHooks: {
                trackModalOpen: true,
                trackCodeCopy: true,
                trackCtaClick: true,
              },
            }
          : undefined,
      embedPost:
        values.contentType === "embed_post"
          ? {
              type: "embed_post",
              provider: values.embedProvider ?? "generic",
              cardTitle: values.embedCardTitle ?? "",
              cardIcon: values.embedCardIcon ?? "",
              cardThumbnail: values.embedCardThumbnail ?? "",
              layout: values.embedLayout ?? "classic",
              modalTitle: values.embedModalTitle ?? "",
              embedMode: values.embedMode ?? "url",
              sourceUrl: values.embedSourceUrl ?? "",
              embedCode: values.embedCode ?? "",
              description: values.embedDescription ?? "",
              ctaButtonLabel: values.embedCtaButtonLabel ?? "",
              ctaUrl: values.embedCtaUrl ?? "",
              dismissible: values.embedDismissible ?? true,
            }
          : undefined,
    });

    if (values.contentType === "discount") {
      updateLinkSettings(editId, {
        thumbnailUrl: values.cardThumbnail || undefined,
      });
    }
    if (values.contentType === "embed_post") {
      updateLinkSettings(editId, {
        thumbnailUrl: values.embedCardThumbnail || undefined,
      });
    }
    setEditId(null);
  });

  const saveSettings = settingsForm.handleSubmit((values) => {
    if (!settingsId) {
      return;
    }

    const hasSchedule = values.startAt || values.endAt;
    updateLinkSettings(settingsId, {
      thumbnailUrl: values.thumbnailUrl || undefined,
      prioritize: values.prioritize,
      locked: values.locked,
      lockMessage: values.lockMessage || undefined,
      schedule: hasSchedule
        ? {
            startAt: values.startAt || undefined,
            endAt: values.endAt || undefined,
          }
        : undefined,
    });
    setSettingsId(null);
  });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    reorderLinks(String(active.id), String(over.id));
  };

  return (
    <SectionCard
      id="links"
      title={t("links_title")}
      description={t("links_desc")}
    >
      <Button
        variant="secondary"
        onClick={() => addLink(createEmptyLink())}
      >
        <Plus className="size-4" />
        {t("links_add")}
      </Button>
      <Button variant="outline" onClick={() => addLink(createEmptyDiscountCode())}>
        <Plus className="size-4" />
        {t("links_add_discount")}
      </Button>
      <Button variant="outline" onClick={() => addLink(createEmptyEmbedPost())}>
        <Plus className="size-4" />
        {t("links_add_embed_post")}
      </Button>
      {uploadWarning ? (
        <p className="text-xs text-amber-600">{uploadWarning}</p>
      ) : null}

      {links.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("links_empty")}
        </div>
      ) : !isDndMounted ? (
        <div className="space-y-3">
          {links.map((link) => (
            <StaticLinkItem
              key={link.id}
              link={link}
              clickCount={0}
              labels={labels}
              onEdit={openEdit}
              onOpenSettings={openSettings}
              onDelete={deleteLink}
              onToggle={toggleLink}
            />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={links.map((link) => link.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {links.map((link) => (
                <SortableLinkItem
                  key={link.id}
                  link={link}
                  clickCount={perLinkClickCounts[link.id] ?? 0}
                  labels={labels}
                  onEdit={openEdit}
                  onOpenSettings={openSettings}
                  onDelete={deleteLink}
                  onToggle={toggleLink}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Sheet
        open={Boolean(editId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditId(null);
            setEditTab("link");
          }
        }}
      >
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("links_edit_title")}</SheetTitle>
            <SheetDescription>{t("links_edit_desc")}</SheetDescription>
          </SheetHeader>
          {editingLink && (
            <form onSubmit={saveEdit} className="space-y-4 px-4">
              {editContentType === "discount" || editContentType === "embed_post" ? (
                <div className="inline-flex rounded-md border bg-muted/35 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditTab("link")}
                    className={cn(
                      "rounded px-3 py-1",
                      editTab === "link" && "bg-background shadow-sm",
                    )}
                  >
                    {editContentType === "embed_post"
                      ? t("embed_post_tabs_settings")
                      : t("links_tab_link_settings")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTab("layout")}
                    className={cn(
                      "rounded px-3 py-1",
                      editTab === "layout" && "bg-background shadow-sm",
                    )}
                  >
                    {editContentType === "embed_post"
                      ? t("embed_post_tabs_layout")
                      : t("links_tab_layout")}
                  </button>
                </div>
              ) : null}
              {editContentType === "embed_post" ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t("embed_post_helper_block")}
                </p>
              ) : null}

              {(editContentType === "link" || editTab === "link") ? (
                <>
                  {editContentType === "link" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("links_label_title")}</Label>
                        <Input
                          aria-invalid={Boolean(editTitleError)}
                          className={editTitleError ? "border-destructive" : undefined}
                          {...editForm.register("title")}
                        />
                        {editTitleError ? (
                          <p className="text-xs text-destructive">{editTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("links_label_url")}</Label>
                        <Input
                          type="url"
                          aria-invalid={Boolean(editUrlError)}
                          className={editUrlError ? "border-destructive" : undefined}
                          {...editForm.register("url")}
                        />
                        {editUrlError ? (
                          <p className="text-xs text-destructive">{editUrlError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("links_label_description")}</Label>
                        <Input {...editForm.register("description")} />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={editEnabled} onCheckedChange={(v) => editForm.setValue("enabled", v)} />
                        {t("links_enabled")}
                      </label>
                    </>
                  ) : editContentType === "discount" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("discount_modal_title")}</Label>
                        <Input
                          aria-invalid={Boolean(editModalTitleError)}
                          className={editModalTitleError ? "border-destructive" : undefined}
                          {...editForm.register("modalTitle")}
                        />
                        {editModalTitleError ? (
                          <p className="text-xs text-destructive">{editModalTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_modal_hero_image")}</Label>
                        <Input
                          type="text"
                          placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                          aria-invalid={Boolean(editModalHeroImageError)}
                          className={editModalHeroImageError ? "border-destructive" : undefined}
                          {...editForm.register("modalHeroImage")}
                        />
                        {editModalHeroImageError ? (
                          <p className="text-xs text-destructive">{editModalHeroImageError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_modal_hero_upload")}</Label>
                        <CustomImageUpload
                          value={editModalHeroImage}
                          preset="avatar_hero"
                          onValueChange={(nextValue) =>
                            editForm.setValue("modalHeroImage", nextValue, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          onError={(message) => setUploadWarning(message)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_modal_description")}</Label>
                        <Input {...editForm.register("modalDescription")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_discount_code")}</Label>
                        <Input
                          aria-invalid={Boolean(editDiscountCodeError)}
                          className={editDiscountCodeError ? "border-destructive" : undefined}
                          {...editForm.register("discountCode")}
                        />
                        {editDiscountCodeError ? (
                          <p className="text-xs text-destructive">{discountCodeErrorText}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_copy_button_label")}</Label>
                        <Input
                          aria-invalid={Boolean(editCopyButtonLabelError)}
                          className={editCopyButtonLabelError ? "border-destructive" : undefined}
                          {...editForm.register("copyButtonLabel")}
                        />
                        {editCopyButtonLabelError ? (
                          <p className="text-xs text-destructive">{editCopyButtonLabelError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_cta_button_label")}</Label>
                        <Input
                          aria-invalid={Boolean(editCtaButtonLabelError)}
                          className={editCtaButtonLabelError ? "border-destructive" : undefined}
                          {...editForm.register("ctaButtonLabel")}
                        />
                        {editCtaButtonLabelError ? (
                          <p className="text-xs text-destructive">{editCtaButtonLabelError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_destination_url")}</Label>
                        <Input
                          type="url"
                          aria-invalid={Boolean(editDestinationUrlError)}
                          className={editDestinationUrlError ? "border-destructive" : undefined}
                          {...editForm.register("destinationUrl")}
                        />
                        {editDestinationUrlError ? (
                          <p className="text-xs text-destructive">{destinationUrlErrorText}</p>
                        ) : null}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={Boolean(editDismissible)}
                          onCheckedChange={(v) => editForm.setValue("dismissible", v)}
                        />
                        {t("discount_dismissible")}
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_modal_title")}</Label>
                        <Input
                          aria-invalid={Boolean(editEmbedModalTitleError)}
                          className={editEmbedModalTitleError ? "border-destructive" : undefined}
                          {...editForm.register("embedModalTitle")}
                        />
                        <p className="text-xs text-muted-foreground">{t("embed_post_helper_modal_title")}</p>
                        {editEmbedModalTitleError ? (
                          <p className="text-xs text-destructive">{editEmbedModalTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_provider")}</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          {...editForm.register("embedProvider")}
                        >
                          <option value="x">{t("embed_post_provider_x")}</option>
                          <option value="facebook">{t("embed_post_provider_facebook")}</option>
                          <option value="tiktok">{t("embed_post_provider_tiktok")}</option>
                          <option value="youtube">{t("embed_post_provider_youtube")}</option>
                          <option value="generic">{t("embed_post_provider_generic")}</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          {editEmbedProvider === "x"
                            ? t("embed_post_provider_hint_x")
                            : editEmbedProvider === "tiktok"
                              ? t("embed_post_provider_hint_tiktok")
                              : editEmbedProvider === "youtube"
                                ? t("embed_post_provider_hint_youtube")
                                : editEmbedProvider === "facebook"
                                  ? t("embed_post_provider_hint_facebook")
                                  : t("embed_post_provider_hint_generic")}
                        </p>
                        {editEmbedProviderError ? (
                          <p className="text-xs text-destructive">{editEmbedProviderError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_embed_mode")}</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          {...editForm.register("embedMode")}
                        >
                          <option value="url">{t("embed_post_mode_url")}</option>
                          <option value="code">{t("embed_post_mode_code")}</option>
                        </select>
                        {editEmbedModeError ? (
                          <p className="text-xs text-destructive">{editEmbedModeError}</p>
                        ) : null}
                      </div>
                      {editEmbedMode === "url" ? (
                        <div className="space-y-2">
                          <Label>{t("embed_post_fields_source_url")}</Label>
                          <Input
                            type="url"
                            aria-invalid={Boolean(editEmbedSourceUrlError)}
                            className={editEmbedSourceUrlError ? "border-destructive" : undefined}
                            {...editForm.register("embedSourceUrl")}
                          />
                          <p className="text-xs text-muted-foreground">{t("embed_post_helper_source_url")}</p>
                          {editEmbedSourceUrlError ? (
                            <p className="text-xs text-destructive">{editEmbedSourceUrlError}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>{t("embed_post_fields_embed_code")}</Label>
                          <Input
                            aria-invalid={Boolean(editEmbedCodeError)}
                            className={editEmbedCodeError ? "border-destructive" : undefined}
                            {...editForm.register("embedCode")}
                          />
                          <p className="text-xs text-muted-foreground">{t("embed_post_helper_embed_code")}</p>
                          {editEmbedCodeError ? (
                            <p className="text-xs text-destructive">{editEmbedCodeError}</p>
                          ) : null}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_description")}</Label>
                        <Input {...editForm.register("embedDescription")} />
                        <p className="text-xs text-muted-foreground">{t("embed_post_helper_description")}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_cta_button_label")}</Label>
                        <Input
                          aria-invalid={Boolean(editEmbedCtaLabelError)}
                          className={editEmbedCtaLabelError ? "border-destructive" : undefined}
                          {...editForm.register("embedCtaButtonLabel")}
                        />
                        {editEmbedCtaLabelError ? (
                          <p className="text-xs text-destructive">{editEmbedCtaLabelError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_cta_url")}</Label>
                        <Input
                          type="url"
                          aria-invalid={Boolean(editEmbedCtaUrlError)}
                          className={editEmbedCtaUrlError ? "border-destructive" : undefined}
                          {...editForm.register("embedCtaUrl")}
                        />
                        <p className="text-xs text-muted-foreground">{t("embed_post_helper_cta_url")}</p>
                        {editEmbedCtaUrlError ? (
                          <p className="text-xs text-destructive">{editEmbedCtaUrlError}</p>
                        ) : null}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={Boolean(editEmbedDismissible)}
                          onCheckedChange={(v) => editForm.setValue("embedDismissible", v)}
                        />
                        {t("embed_post_fields_dismissible")}
                      </label>
                    </>
                  )}
                </>
              ) : null}

              {(editContentType === "discount" || editContentType === "embed_post") && editTab === "layout" ? (
                <>
                  <div className="space-y-2">
                    <Label>
                      {editContentType === "embed_post"
                        ? t("embed_post_fields_layout")
                        : t("links_label_layout")}
                    </Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      {...editForm.register(editContentType === "discount" ? "layout" : "embedLayout")}
                    >
                      <option value="classic">{t("links_layout_classic")}</option>
                      <option value="featured">{t("links_layout_featured")}</option>
                    </select>
                    {editLayoutErrorText ? (
                      <p className="text-xs text-destructive">{editLayoutErrorText}</p>
                    ) : null}
                  </div>
                  {editContentType === "discount" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("discount_card_title")}</Label>
                        <Input
                          aria-invalid={Boolean(editCardTitleError)}
                          className={editCardTitleError ? "border-destructive" : undefined}
                          {...editForm.register("cardTitle")}
                        />
                        {editCardTitleError ? (
                          <p className="text-xs text-destructive">{editCardTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("discount_card_thumbnail")}</Label>
                        <Input
                          type="text"
                          placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                          aria-invalid={Boolean(editCardThumbnailError)}
                          className={editCardThumbnailError ? "border-destructive" : undefined}
                          {...editForm.register("cardThumbnail")}
                        />
                        {editCardThumbnailError ? (
                          <p className="text-xs text-destructive">{editCardThumbnailError}</p>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_card_title")}</Label>
                        <Input
                          aria-invalid={Boolean(editEmbedCardTitleError)}
                          className={editEmbedCardTitleError ? "border-destructive" : undefined}
                          {...editForm.register("embedCardTitle")}
                        />
                        <p className="text-xs text-muted-foreground">{t("embed_post_helper_card_title")}</p>
                        {editEmbedCardTitleError ? (
                          <p className="text-xs text-destructive">{editEmbedCardTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_card_icon")}</Label>
                        <Input
                          type="text"
                          placeholder="https://... or data:image/..."
                          aria-invalid={Boolean(editEmbedCardIconError)}
                          className={editEmbedCardIconError ? "border-destructive" : undefined}
                          {...editForm.register("embedCardIcon")}
                        />
                        <p className="text-xs text-muted-foreground">{t("embed_post_helper_card_icon")}</p>
                        {editEmbedCardIconError ? (
                          <p className="text-xs text-destructive">{editEmbedCardIconError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_card_thumbnail")}</Label>
                        <Input
                          type="text"
                          placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                          aria-invalid={Boolean(editEmbedCardThumbError)}
                          className={editEmbedCardThumbError ? "border-destructive" : undefined}
                          {...editForm.register("embedCardThumbnail")}
                        />
                        <p className="text-xs text-muted-foreground">{t("embed_post_helper_card_thumbnail")}</p>
                        {editEmbedCardThumbError ? (
                          <p className="text-xs text-destructive">{editEmbedCardThumbError}</p>
                        ) : null}
                      </div>
                    </>
                  )}
                  {editContentType === "discount" ? (
                    <div className="space-y-2">
                      <Label>{t("discount_card_thumbnail_upload")}</Label>
                      <CustomImageUpload
                        value={editCardThumbnail}
                        preset="thumbnail_banner"
                        onValueChange={(nextValue) =>
                          editForm.setValue("cardThumbnail", nextValue, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        onError={(message) => setUploadWarning(message)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_card_icon")}</Label>
                        <CustomImageUpload
                          value={editEmbedCardIcon}
                          preset="icon"
                          onValueChange={(nextValue) =>
                            editForm.setValue("embedCardIcon", nextValue, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          onError={(message) => setUploadWarning(message)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_card_thumbnail")}</Label>
                        <CustomImageUpload
                          value={editEmbedCardThumbnail}
                          preset="thumbnail_banner"
                          onValueChange={(nextValue) =>
                            editForm.setValue("embedCardThumbnail", nextValue, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          onError={(message) => setUploadWarning(message)}
                        />
                      </div>
                    </>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={editEnabled} onCheckedChange={(v) => editForm.setValue("enabled", v)} />
                    {t("links_enabled")}
                  </label>
                </>
              ) : null}
              <SheetFooter className="px-0">
                <Button type="submit">{t("links_save")}</Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Drawer open={Boolean(settingsId)} onOpenChange={(open) => !open && setSettingsId(null)}>
        <DrawerContent className="mx-auto w-full max-w-xl">
          <DrawerHeader>
            <DrawerTitle>{t("links_settings_title")}</DrawerTitle>
            <DrawerDescription>
              {t("links_settings_desc")}
            </DrawerDescription>
          </DrawerHeader>
          {settingsLink && (
            <form onSubmit={saveSettings} className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <Label>{t("links_thumbnail_url")}</Label>
                <Input
                  type="text"
                  placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                  aria-invalid={Boolean(settingsThumbnailError)}
                  className={settingsThumbnailError ? "border-destructive" : undefined}
                  {...settingsForm.register("thumbnailUrl")}
                />
                {settingsThumbnailError ? (
                  <p className="text-xs text-destructive">{settingsThumbnailError}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t("links_upload_thumbnail")}</Label>
                <CustomImageUpload
                  value={settingsThumbnailUrl}
                  preset="thumbnail_banner"
                  onValueChange={(nextValue) =>
                    settingsForm.setValue("thumbnailUrl", nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onError={(message) => setUploadWarning(message)}
                />
              </div>
              <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                {t("links_prioritize")}
                <Switch
                  checked={prioritize}
                  onCheckedChange={(value) => settingsForm.setValue("prioritize", value)}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("links_schedule_start")}</Label>
                  <Input type="datetime-local" {...settingsForm.register("startAt")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("links_schedule_end")}</Label>
                  <Input type="datetime-local" {...settingsForm.register("endAt")} />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                {t("links_locked_link")}
                <Switch
                  checked={locked}
                  onCheckedChange={(value) => settingsForm.setValue("locked", value)}
                />
              </label>
              <div className="space-y-2">
                <Label>{t("links_lock_message")}</Label>
                <Input {...settingsForm.register("lockMessage")} />
              </div>
              <DrawerFooter className="px-0">
                <Button type="submit">{t("links_save_settings")}</Button>
              </DrawerFooter>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </SectionCard>
  );
};
