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
import { BioLink, FormTemplate } from "@/features/builder/types";
import {
  createEmptyDiscountCode,
  createEmptyEmbedPost,
  createEmptyFormBlock,
  createEmptyLink,
  getContentType,
  getDiscountData,
  getEmbedPostData,
  getFormData,
  getFormTemplateFields,
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
    formType: string;
    formSupportDepositType: string;
    formSupportWithdrawType: string;
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
  const isForm = getContentType(link) === "form";
  const discount = isDiscount ? getDiscountData(link) : null;
  const embedPost = isEmbedPost ? getEmbedPostData(link) : null;
  const form = isForm ? getFormData(link) : null;
  const formTypeLabel =
    form?.template === "deposit_issue"
      ? labels.formSupportDepositType
      : form?.template === "withdraw_issue"
        ? labels.formSupportWithdrawType
        : labels.formType;
  const displayTitle = isDiscount
    ? discount?.cardTitle || link.title
    : isEmbedPost
      ? embedPost?.cardTitle || link.title
      : isForm
        ? form?.formTitle || link.title
      : link.title;
  const displayUrl = isDiscount
    ? discount?.destinationUrl || link.url
    : isEmbedPost
      ? embedPost?.ctaUrl || link.url
      : isForm
        ? link.url
      : link.url;
  const isInvalidUrl = !linkSchema.shape.url.safeParse(displayUrl).success;

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto_auto_auto] sm:items-center">
        {dragHandle}
        <div>
          <p className="text-sm font-semibold">{displayTitle}</p>
          {isDiscount || isEmbedPost || isForm ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-amber-700">
              {isDiscount ? labels.discountType : isEmbedPost ? labels.embedType : formTypeLabel} ·{" "}
              {(isDiscount ? discount?.layout : isEmbedPost ? embedPost?.layout : form?.layout) === "featured"
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
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [addPickerStep, setAddPickerStep] = useState<"types" | "form_templates">("types");

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
      formTemplate: "email_signup",
      formLayout: "classic",
      formTitle: "",
      formIntro: "",
      formOutro: "",
      formSubmitLabel: "Submit",
      formCancelLabel: "Cancel",
      formTermsPlaceholder: "",
      preOpenEnabled: false,
      preOpenBannerImageUrl: "",
      preOpenTitle: "",
      preOpenDescription: "",
      preOpenPrimaryButtonLabel: "Continue",
      preOpenDestinationUrl: "",
      preOpenShowSecondaryButton: true,
      preOpenSecondaryButtonLabel: "Close",
      preOpenDismissible: true,
      preOpenButtonStyle: "solid",
      style: "icon_left",
      textAlign: "left",
      bannerRatio: "3:1",
      imageFit: "cover",
      imageUrl: "",
      iconImageUrl: "",
      backgroundImageUrl: "",
      preserveLineBreaks: true,
      textPanelContent: "",
      openInNewTab: true,
      sortOrder: 0,
      titleSize: 0,
      textColor: "",
      backgroundColor: "",
      borderColor: "",
      showBorder: true,
      borderRadius: 0,
      formFields: [],
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
  const editDismissible = useWatch({ control: editForm.control, name: "dismissible" });
  const editEmbedProvider = useWatch({ control: editForm.control, name: "embedProvider" });
  const editEmbedMode = useWatch({ control: editForm.control, name: "embedMode" });
  const editEmbedDismissible = useWatch({
    control: editForm.control,
    name: "embedDismissible",
  });
  const editFormTemplate = useWatch({ control: editForm.control, name: "formTemplate" });
  const editPreOpenEnabled = useWatch({ control: editForm.control, name: "preOpenEnabled" });
  const editPreOpenShowSecondaryButton = useWatch({
    control: editForm.control,
    name: "preOpenShowSecondaryButton",
  });
  const editPreOpenDismissible = useWatch({
    control: editForm.control,
    name: "preOpenDismissible",
  });
  const editStyle = useWatch({ control: editForm.control, name: "style" });
  const editOpenInNewTab = useWatch({ control: editForm.control, name: "openInNewTab" });
  const editPreserveLineBreaks = useWatch({ control: editForm.control, name: "preserveLineBreaks" });
  const editFormFields = useWatch({ control: editForm.control, name: "formFields" }) ?? [];
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
  const editFormTitleError = editForm.formState.errors.formTitle?.message;
  const editFormLayoutError = editForm.formState.errors.formLayout?.message;
  const editFormSubmitLabelError = editForm.formState.errors.formSubmitLabel?.message;
  const editImageUrlError = editForm.formState.errors.imageUrl?.message;
  const editIconImageUrlError = editForm.formState.errors.iconImageUrl?.message;
  const editBackgroundImageUrlError = editForm.formState.errors.backgroundImageUrl?.message;
  const editFormFieldsError = editForm.formState.errors.formFields?.message as string | undefined;
  const editLayoutErrorText =
    editContentType === "discount"
      ? editLayoutError
      : editContentType === "embed_post"
        ? editEmbedLayoutError
        : editFormLayoutError;
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
      formType: t("links_type_form"),
      formSupportDepositType: t("links_type_form_support_deposit"),
      formSupportWithdrawType: t("links_type_form_support_withdraw"),
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
    const form = getFormData(link);
    const isDiscount = getContentType(link) === "discount";
    const isEmbedPost = getContentType(link) === "embed_post";
    const isForm = getContentType(link) === "form";
    editForm.reset({
      contentType: getContentType(link),
      title: isDiscount ? discount.cardTitle : isEmbedPost ? embedPost.cardTitle : isForm ? form.formTitle : link.title,
      url: isDiscount ? discount.destinationUrl : isEmbedPost ? embedPost.ctaUrl : link.url,
      description: isDiscount
        ? discount.modalDescription
        : isEmbedPost
          ? embedPost.description
          : isForm
            ? form.intro
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
      formTemplate: form.template,
      formLayout: form.layout,
      formTitle: form.formTitle,
      formIntro: form.intro,
      formOutro: form.outro,
      formSubmitLabel: form.submitLabel,
      formCancelLabel: form.cancelLabel ?? t("form_submit_cancel"),
      formTermsPlaceholder: form.termsPlaceholder ?? "",
      preOpenEnabled: link.preOpenModal?.enabled ?? false,
      preOpenBannerImageUrl: link.preOpenModal?.bannerImageUrl ?? "",
      preOpenTitle: link.preOpenModal?.title ?? "",
      preOpenDescription: link.preOpenModal?.description ?? "",
      preOpenPrimaryButtonLabel: link.preOpenModal?.primaryButtonLabel ?? "Continue",
      preOpenDestinationUrl: link.preOpenModal?.destinationUrl ?? "",
      preOpenShowSecondaryButton: link.preOpenModal?.showSecondaryButton ?? true,
      preOpenSecondaryButtonLabel: link.preOpenModal?.secondaryButtonLabel ?? "Close",
      preOpenDismissible: link.preOpenModal?.dismissible ?? true,
      preOpenButtonStyle: link.preOpenModal?.buttonStyle ?? "solid",
      style: link.settings.style ?? link.settings.displayStyle ?? "icon_left",
      textAlign: link.settings.textAlign ?? "left",
      bannerRatio: link.settings.bannerRatio ?? "3:1",
      imageFit: link.settings.imageFit ?? "cover",
      imageUrl: link.settings.imageUrl ?? "",
      iconImageUrl: link.settings.iconImageUrl ?? "",
      backgroundImageUrl: link.settings.backgroundImageUrl ?? "",
      preserveLineBreaks: link.settings.preserveLineBreaks ?? true,
      textPanelContent: link.settings.textPanelContent ?? "",
      openInNewTab: link.settings.openInNewTab ?? true,
      sortOrder: link.settings.sortOrder ?? 0,
      titleSize: link.settings.titleSize ?? 0,
      textColor: link.settings.textColor ?? "",
      backgroundColor: link.settings.backgroundColor ?? "",
      borderColor: link.settings.borderColor ?? "",
      showBorder: link.settings.showBorder ?? true,
      borderRadius: link.settings.borderRadius ?? 0,
      formFields: form.fields,
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
          : values.contentType === "form"
              ? values.formTitle ?? ""
            : values.title ?? "",
      url:
        values.contentType === "discount"
          ? values.destinationUrl ?? ""
          : values.contentType === "embed_post"
            ? values.embedCtaUrl ?? ""
          : values.contentType === "form"
              ? values.url || "https://example.com/form"
            : values.url ?? "",
      description:
        values.contentType === "discount"
          ? values.modalDescription
          : values.contentType === "embed_post"
            ? values.embedDescription
          : values.contentType === "form"
              ? values.formIntro
            : values.description ?? "",
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
      form:
        values.contentType === "form"
          ? {
              type: "form",
              template: values.formTemplate ?? "custom",
              layout: values.formLayout ?? "classic",
              formTitle: values.formTitle ?? "",
              intro: values.formIntro ?? "",
              outro: values.formOutro ?? "",
              submitLabel: values.formSubmitLabel ?? "Submit",
              cancelLabel: values.formCancelLabel ?? "Cancel",
              termsPlaceholder: values.formTermsPlaceholder ?? "",
              fields: (values.formFields ?? []).map((field) => ({
                id: field.id,
                label: field.label,
                type: field.type,
                required: field.required,
                placeholder: field.placeholder ?? "",
                options: field.options?.map((option) => option.trim()).filter(Boolean) ?? undefined,
              })),
            }
          : undefined,
      preOpenModal: {
        enabled: values.preOpenEnabled ?? false,
        bannerImageUrl: values.preOpenBannerImageUrl ?? "",
        title: values.preOpenTitle ?? "",
        description: values.preOpenDescription ?? "",
        primaryButtonLabel: values.preOpenPrimaryButtonLabel ?? "Continue",
        destinationUrl: values.preOpenDestinationUrl ?? "",
        showSecondaryButton: values.preOpenShowSecondaryButton ?? true,
        secondaryButtonLabel: values.preOpenSecondaryButtonLabel ?? "Close",
        dismissible: values.preOpenDismissible ?? true,
        buttonStyle: values.preOpenButtonStyle ?? "solid",
      },
    });
    updateLinkSettings(editId, {
      style: values.style ?? "icon_left",
      textAlign: values.textAlign ?? "left",
      bannerRatio: values.bannerRatio ?? "3:1",
      imageFit: values.imageFit ?? "cover",
      imageUrl: values.imageUrl || undefined,
      iconImageUrl: values.iconImageUrl || undefined,
      backgroundImageUrl: values.backgroundImageUrl || undefined,
      preserveLineBreaks: values.preserveLineBreaks ?? true,
      textPanelContent: values.textPanelContent ?? "",
      openInNewTab: values.openInNewTab ?? true,
      sortOrder: values.sortOrder,
      titleSize: values.titleSize || undefined,
      textColor: values.textColor || undefined,
      backgroundColor: values.backgroundColor || undefined,
      borderColor: values.borderColor || undefined,
      showBorder: values.showBorder ?? true,
      borderRadius: values.borderRadius || undefined,
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
    if (values.contentType === "form") {
      updateLinkSettings(editId, {
        thumbnailUrl: undefined,
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

  const setFormFields = (nextFields: NonNullable<LinkFormValues["formFields"]>) => {
    editForm.setValue("formFields", nextFields, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const addFormField = () => {
    setFormFields([
      ...editFormFields,
      {
        id: `form-field-${Math.random().toString(36).slice(2, 9)}`,
        label: t("form_field_label_default"),
        type: "short_answer",
        required: false,
        placeholder: "",
        options: [],
      },
    ]);
  };

  const removeFormField = (index: number) => {
    setFormFields(editFormFields.filter((_, fieldIndex) => fieldIndex !== index));
  };

  const moveFormField = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= editFormFields.length) {
      return;
    }
    const next = [...editFormFields];
    const [current] = next.splice(index, 1);
    next.splice(nextIndex, 0, current);
    setFormFields(next);
  };

  const updateFormField = (
    index: number,
    payload: Partial<NonNullable<LinkFormValues["formFields"]>[number]>,
  ) => {
    setFormFields(
      editFormFields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...payload } : field,
      ),
    );
  };

  const applyFormTemplate = (template: NonNullable<LinkFormValues["formTemplate"]>) => {
    editForm.setValue("formTemplate", template, { shouldDirty: true, shouldValidate: true });
    setFormFields(
      getFormTemplateFields(template).map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder ?? "",
        options: field.options ?? [],
      })),
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    reorderLinks(String(active.id), String(over.id));
  };

  const handleAddType = (type: "link" | "discount" | "embed_post" | "form") => {
    if (type === "form") {
      setAddPickerStep("form_templates");
      return;
    }
    if (type === "link") {
      addLink(createEmptyLink());
    } else if (type === "discount") {
      addLink(createEmptyDiscountCode());
    } else {
      addLink(createEmptyEmbedPost());
    }
    setAddPickerOpen(false);
    setAddPickerStep("types");
  };

  const handleAddFormTemplate = (template: FormTemplate) => {
    addLink(createEmptyFormBlock(template));
    setAddPickerOpen(false);
    setAddPickerStep("types");
  };

  return (
    <SectionCard
      id="links"
      title={t("links_title")}
      description={t("links_desc")}
    >
      <Button
        variant="secondary"
        onClick={() => {
          setAddPickerOpen((current) => !current);
          setAddPickerStep("types");
        }}
      >
        <Plus className="size-4" />
        {t("links_add")}
      </Button>
      {addPickerOpen ? (
        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          {addPickerStep === "types" ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("links_add_choose_type")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => handleAddType("link")}>
                  {t("links_add_type_link")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddType("discount")}>
                  {t("links_add_type_discount")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddType("embed_post")}>
                  {t("links_add_type_embed")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddType("form")}>
                  {t("links_add_type_form")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {t("form_template")}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddPickerStep("types")}>
                  {t("saved_manager_cancel")}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => handleAddFormTemplate("contact_form")}>
                  {t("form_template_contact_form")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddFormTemplate("email_signup")}>
                  {t("form_template_email_signup")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddFormTemplate("sms_signup")}>
                  {t("form_template_sms_signup")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddFormTemplate("custom")}>
                  {t("form_template_custom")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddFormTemplate("deposit_issue")}>
                  {t("form_template_deposit_issue")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddFormTemplate("withdraw_issue")}>
                  {t("form_template_withdraw_issue")}
                </Button>
              </div>
            </>
          )}
        </div>
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
        <SheetContent
          side="right"
          className="overflow-y-auto overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>{t("links_edit_title")}</SheetTitle>
            <SheetDescription>{t("links_edit_desc")}</SheetDescription>
          </SheetHeader>
          {editingLink && (
            <form
              onSubmit={saveEdit}
              className="space-y-4 overflow-x-hidden px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              {editContentType === "discount" || editContentType === "embed_post" || editContentType === "form" || editContentType === "link" ? (
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
                      : editContentType === "form"
                        ? t("form_tabs_settings")
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
                      : editContentType === "form"
                        ? t("form_tabs_layout")
                        : t("links_tab_layout")}
                  </button>
                </div>
              ) : null}
              {editContentType === "embed_post" ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t("embed_post_helper_block")}
                </p>
              ) : editContentType === "form" ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t("form_helper_block")}
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
                        <textarea
                          className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                          {...editForm.register("description")}
                        />
                      </div>
                      <div className="space-y-3 rounded-xl border p-3">
                        <p className="text-sm font-medium">{t("pre_open_modal_section")}</p>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editPreOpenEnabled)}
                            onCheckedChange={(v) =>
                              editForm.setValue("preOpenEnabled", v, { shouldDirty: true, shouldValidate: true })
                            }
                          />
                          {t("pre_open_modal_enabled")}
                        </label>
                        {editPreOpenEnabled ? (
                          <>
                            <div className="space-y-2">
                              <Label>{t("pre_open_modal_banner_image")}</Label>
                              <Input {...editForm.register("preOpenBannerImageUrl")} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("pre_open_modal_title")}</Label>
                              <Input {...editForm.register("preOpenTitle")} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("pre_open_modal_description")}</Label>
                              <Input {...editForm.register("preOpenDescription")} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("pre_open_modal_primary_label")}</Label>
                              <Input {...editForm.register("preOpenPrimaryButtonLabel")} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("pre_open_modal_destination_url")}</Label>
                              <Input {...editForm.register("preOpenDestinationUrl")} />
                              <p className="text-xs text-muted-foreground">{t("pre_open_modal_destination_help")}</p>
                            </div>
                            <div className="space-y-2">
                              <Label>{t("pre_open_modal_button_style")}</Label>
                              <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                {...editForm.register("preOpenButtonStyle")}
                              >
                                <option value="solid">{t("pre_open_modal_button_style_solid")}</option>
                                <option value="outline">{t("pre_open_modal_button_style_outline")}</option>
                                <option value="glow">{t("pre_open_modal_button_style_glow")}</option>
                              </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Switch
                                checked={Boolean(editPreOpenShowSecondaryButton)}
                                onCheckedChange={(v) =>
                                  editForm.setValue("preOpenShowSecondaryButton", v, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                              />
                              {t("pre_open_modal_show_secondary")}
                            </label>
                            {editPreOpenShowSecondaryButton ? (
                              <div className="space-y-2">
                                <Label>{t("pre_open_modal_secondary_label")}</Label>
                                <Input {...editForm.register("preOpenSecondaryButtonLabel")} />
                              </div>
                            ) : null}
                            <label className="flex items-center gap-2 text-sm">
                              <Switch
                                checked={Boolean(editPreOpenDismissible)}
                                onCheckedChange={(v) =>
                                  editForm.setValue("preOpenDismissible", v, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                              />
                              {t("pre_open_modal_dismissible")}
                            </label>
                          </>
                        ) : null}
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
                  ) : editContentType === "form" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("form_template")}</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={editFormTemplate}
                          onChange={(event) => applyFormTemplate(event.target.value as NonNullable<LinkFormValues["formTemplate"]>)}
                        >
                          <option value="email_signup">{t("form_template_email_signup")}</option>
                          <option value="sms_signup">{t("form_template_sms_signup")}</option>
                          <option value="contact_form">{t("form_template_contact_form")}</option>
                          <option value="custom">{t("form_template_custom")}</option>
                          <option value="deposit_issue">{t("form_template_deposit_issue")}</option>
                          <option value="withdraw_issue">{t("form_template_withdraw_issue")}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("form_title_label")}</Label>
                        <Input
                          aria-invalid={Boolean(editFormTitleError)}
                          className={editFormTitleError ? "border-destructive" : undefined}
                          {...editForm.register("formTitle")}
                        />
                        {editFormTitleError ? (
                          <p className="text-xs text-destructive">{editFormTitleError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("form_intro_label")}</Label>
                        <Input {...editForm.register("formIntro")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("form_outro_label")}</Label>
                        <Input {...editForm.register("formOutro")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("form_submit_label")}</Label>
                        <Input
                          aria-invalid={Boolean(editFormSubmitLabelError)}
                          className={editFormSubmitLabelError ? "border-destructive" : undefined}
                          {...editForm.register("formSubmitLabel")}
                        />
                        {editFormSubmitLabelError ? (
                          <p className="text-xs text-destructive">{editFormSubmitLabelError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("form_cancel_label")}</Label>
                        <Input {...editForm.register("formCancelLabel")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("form_terms_placeholder")}</Label>
                        <Input {...editForm.register("formTermsPlaceholder")} />
                      </div>
                      <div className="space-y-3 rounded-xl border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{t("form_fields_title")}</p>
                          <Button type="button" variant="outline" size="sm" onClick={addFormField}>
                            <Plus className="size-4" />
                            {t("form_add_field")}
                          </Button>
                        </div>
                        {editFormFields.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("form_fields_empty")}</p>
                        ) : null}
                        {editFormFields.map((field, fieldIndex) => {
                          const needsOptions =
                            field.type === "single_choice" ||
                            field.type === "checkboxes" ||
                            field.type === "dropdown";
                          return (
                            <div key={field.id || `form-field-${fieldIndex}`} className="space-y-2 rounded-lg border p-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Input
                                  value={field.label}
                                  onChange={(event) =>
                                    updateFormField(fieldIndex, { label: event.target.value })
                                  }
                                  placeholder={t("form_field_label")}
                                />
                                <select
                                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                  value={field.type}
                                  onChange={(event) =>
                                    updateFormField(fieldIndex, {
                                      type: event.target.value as NonNullable<LinkFormValues["formFields"]>[number]["type"],
                                      options:
                                        event.target.value === "single_choice" ||
                                        event.target.value === "checkboxes" ||
                                        event.target.value === "dropdown"
                                          ? field.options && field.options.length > 0
                                            ? field.options
                                            : [t("form_option_default")]
                                          : [],
                                    })
                                  }
                                >
                                  <option value="name">{t("form_field_type_name")}</option>
                                  <option value="email">{t("form_field_type_email")}</option>
                                  <option value="phone">{t("form_field_type_phone")}</option>
                                  <option value="country">{t("form_field_type_country")}</option>
                                  <option value="date_of_birth">{t("form_field_type_date_of_birth")}</option>
                                  <option value="time_hms">{t("form_field_type_time_hms")}</option>
                                  <option value="short_answer">{t("form_field_type_short_answer")}</option>
                                  <option value="paragraph">{t("form_field_type_paragraph")}</option>
                                  <option value="single_choice">{t("form_field_type_single_choice")}</option>
                                  <option value="checkboxes">{t("form_field_type_checkboxes")}</option>
                                  <option value="dropdown">{t("form_field_type_dropdown")}</option>
                                  <option value="date">{t("form_field_type_date")}</option>
                                  <option value="file_image">{t("form_field_type_file_image")}</option>
                                </select>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                                <Input
                                  value={field.placeholder ?? ""}
                                  onChange={(event) =>
                                    updateFormField(fieldIndex, { placeholder: event.target.value })
                                  }
                                  placeholder={t("form_field_placeholder")}
                                />
                                <label className="flex items-center gap-2 text-xs">
                                  <Switch
                                    checked={Boolean(field.required)}
                                    onCheckedChange={(nextValue) =>
                                      updateFormField(fieldIndex, { required: nextValue })
                                    }
                                  />
                                  {t("form_required")}
                                </label>
                                <Button type="button" variant="ghost" size="sm" onClick={() => moveFormField(fieldIndex, -1)}>
                                  {t("form_move_up")}
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => moveFormField(fieldIndex, 1)}>
                                  {t("form_move_down")}
                                </Button>
                              </div>
                              {needsOptions ? (
                                <Input
                                  value={(field.options ?? []).join(", ")}
                                  onChange={(event) =>
                                    updateFormField(fieldIndex, {
                                      options: event.target.value
                                        .split(",")
                                        .map((option) => option.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder={t("form_options_placeholder")}
                                />
                              ) : null}
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFormField(fieldIndex)}
                                >
                                  {t("form_remove_field")}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {editFormFieldsError ? (
                          <p className="text-xs text-destructive">{editFormFieldsError}</p>
                        ) : null}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={editEnabled} onCheckedChange={(v) => editForm.setValue("enabled", v)} />
                        {t("links_enabled")}
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

              {(editContentType === "discount" || editContentType === "embed_post" || editContentType === "form" || editContentType === "link") && editTab === "layout" ? (
                <>
                  <div className="space-y-2">
                    <Label>{t("links_display_style")}</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      {...editForm.register("style")}
                    >
                      <option value="icon_left">{t("links_display_style_icon_left")}</option>
                      <option value="image_banner">{t("links_display_style_image_full")}</option>
                      <option value="text_only">{t("links_display_style_text_only")}</option>
                      <option value="media_card">{t("links_display_style_card_left_image")}</option>
                      <option value="text_panel">{t("links_display_style_text_panel")}</option>
                    </select>
                  </div>
                  {editStyle === "icon_left" ? (
                    <div className="space-y-2">
                      <Label>{t("links_style_icon_image_url")}</Label>
                      <Input
                        placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                        aria-invalid={Boolean(editIconImageUrlError)}
                        className={editIconImageUrlError ? "border-destructive" : undefined}
                        {...editForm.register("iconImageUrl")}
                      />
                      {editIconImageUrlError ? (
                        <p className="text-xs text-destructive">{editIconImageUrlError}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {editStyle === "image_banner" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("links_style_background_image_url")}</Label>
                        <Input
                          placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                          aria-invalid={Boolean(editBackgroundImageUrlError)}
                          className={editBackgroundImageUrlError ? "border-destructive" : undefined}
                          {...editForm.register("backgroundImageUrl")}
                        />
                        {editBackgroundImageUrlError ? (
                          <p className="text-xs text-destructive">{editBackgroundImageUrlError}</p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("links_style_image_aspect")}</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          {...editForm.register("bannerRatio")}
                        >
                          <option value="3:1">{t("links_style_image_aspect_3_1")}</option>
                          <option value="2:1">{t("links_style_image_aspect_2_1")}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("links_style_image_fit")}</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          {...editForm.register("imageFit")}
                        >
                          <option value="cover">{t("links_style_image_fit_cover")}</option>
                          <option value="contain">{t("links_style_image_fit_contain")}</option>
                        </select>
                      </div>
                    </>
                  ) : null}
                  {editStyle === "media_card" ? (
                    <div className="space-y-2">
                      <Label>{t("links_style_image_url")}</Label>
                      <Input
                        placeholder="https://... or /placeholders/link-thumbnail-default.svg"
                        aria-invalid={Boolean(editImageUrlError)}
                        className={editImageUrlError ? "border-destructive" : undefined}
                        {...editForm.register("imageUrl")}
                      />
                      {editImageUrlError ? (
                        <p className="text-xs text-destructive">{editImageUrlError}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {(editStyle === "icon_left" || editStyle === "text_only") ? (
                    <div className="space-y-2">
                      <Label>{t("links_style_text_align")}</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        {...editForm.register("textAlign")}
                      >
                        <option value="left">{t("links_style_text_align_left")}</option>
                        <option value="center">{t("links_style_text_align_center")}</option>
                        <option value="right">{t("links_style_text_align_right")}</option>
                      </select>
                    </div>
                  ) : null}
                  {editStyle === "text_panel" ? (
                    <div className="space-y-2">
                      <Label>{t("links_style_text_panel_content")}</Label>
                      <textarea
                        className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        {...editForm.register("textPanelContent")}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={Boolean(editPreserveLineBreaks)}
                          onCheckedChange={(value) =>
                            editForm.setValue("preserveLineBreaks", value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                        {t("links_style_preserve_line_breaks")}
                      </label>
                    </div>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={Boolean(editOpenInNewTab)}
                      onCheckedChange={(value) =>
                        editForm.setValue("openInNewTab", value, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                    {t("links_style_open_in_new_tab")}
                  </label>
                  {editContentType !== "link" ? (
                    <div className="space-y-2">
                      <Label>
                        {editContentType === "embed_post"
                          ? t("embed_post_fields_layout")
                          : editContentType === "form"
                            ? t("form_layout_label")
                            : t("links_label_layout")}
                      </Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        {...editForm.register(
                          editContentType === "discount"
                            ? "layout"
                            : editContentType === "embed_post"
                              ? "embedLayout"
                              : "formLayout",
                        )}
                      >
                        <option value="classic">{t("links_layout_classic")}</option>
                        <option value="featured">{t("links_layout_featured")}</option>
                      </select>
                      {editLayoutErrorText ? (
                        <p className="text-xs text-destructive">{editLayoutErrorText}</p>
                      ) : null}
                    </div>
                  ) : null}
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
                  ) : editContentType === "embed_post" ? (
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
                  ) : null}
                  {editContentType === "form" ? (
                    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      {t("form_layout_helper")}
                    </div>
                  ) : null}
                  <div className="space-y-3 rounded-xl border p-3">
                    <p className="text-sm font-medium">{t("pre_open_modal_section")}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={Boolean(editPreOpenEnabled)}
                        onCheckedChange={(v) =>
                          editForm.setValue("preOpenEnabled", v, { shouldDirty: true, shouldValidate: true })
                        }
                      />
                      {t("pre_open_modal_enabled")}
                    </label>
                    {editPreOpenEnabled ? (
                      <>
                        <div className="space-y-2">
                          <Label>{t("pre_open_modal_banner_image")}</Label>
                          <Input {...editForm.register("preOpenBannerImageUrl")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pre_open_modal_title")}</Label>
                          <Input {...editForm.register("preOpenTitle")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pre_open_modal_description")}</Label>
                          <Input {...editForm.register("preOpenDescription")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pre_open_modal_primary_label")}</Label>
                          <Input {...editForm.register("preOpenPrimaryButtonLabel")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pre_open_modal_destination_url")}</Label>
                          <Input {...editForm.register("preOpenDestinationUrl")} />
                          <p className="text-xs text-muted-foreground">{t("pre_open_modal_destination_help")}</p>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pre_open_modal_button_style")}</Label>
                          <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            {...editForm.register("preOpenButtonStyle")}
                          >
                            <option value="solid">{t("pre_open_modal_button_style_solid")}</option>
                            <option value="outline">{t("pre_open_modal_button_style_outline")}</option>
                            <option value="glow">{t("pre_open_modal_button_style_glow")}</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editPreOpenShowSecondaryButton)}
                            onCheckedChange={(v) =>
                              editForm.setValue("preOpenShowSecondaryButton", v, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          {t("pre_open_modal_show_secondary")}
                        </label>
                        {editPreOpenShowSecondaryButton ? (
                          <div className="space-y-2">
                            <Label>{t("pre_open_modal_secondary_label")}</Label>
                            <Input {...editForm.register("preOpenSecondaryButtonLabel")} />
                          </div>
                        ) : null}
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editPreOpenDismissible)}
                            onCheckedChange={(v) =>
                              editForm.setValue("preOpenDismissible", v, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          />
                          {t("pre_open_modal_dismissible")}
                        </label>
                      </>
                    ) : null}
                  </div>
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
        <DrawerContent className="mx-auto w-full max-w-xl overflow-y-auto overflow-x-hidden">
          <DrawerHeader>
            <DrawerTitle>{t("links_settings_title")}</DrawerTitle>
            <DrawerDescription>
              {t("links_settings_desc")}
            </DrawerDescription>
          </DrawerHeader>
          {settingsLink && (
            <form
              onSubmit={saveSettings}
              className="space-y-4 overflow-x-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
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
