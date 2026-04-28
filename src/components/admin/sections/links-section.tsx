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
import { FieldErrors, useForm, useWatch } from "react-hook-form";

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
  createEmptyExternalForm,
  createEmptyFormBlock,
  createEmptyLink,
  createEmptyPromoGallery,
  getContentType,
  getDiscountData,
  getEmbedPostData,
  getExternalFormData,
  getFormData,
  getPromoGalleryData,
  getFormTemplateFields,
  normalizeFormFieldType,
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
    promoGalleryType: string;
    externalFormType: string;
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
  const isPromoGallery = getContentType(link) === "promo_gallery";
  const isExternalForm = getContentType(link) === "external_form";
  const discount = isDiscount ? getDiscountData(link) : null;
  const embedPost = isEmbedPost ? getEmbedPostData(link) : null;
  const form = isForm ? getFormData(link) : null;
  const promoGallery = isPromoGallery ? getPromoGalleryData(link) : null;
  const externalForm = isExternalForm ? getExternalFormData(link) : null;
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
      : isPromoGallery
        ? promoGallery?.title || link.title
      : isExternalForm
        ? externalForm?.title || link.title
      : link.title;
  const displayUrl = isDiscount
    ? discount?.destinationUrl || link.url
    : isEmbedPost
      ? embedPost?.ctaUrl || link.url
      : isForm
        ? link.url
      : isPromoGallery
        ? ""
      : isExternalForm
        ? externalForm?.formUrl || link.url
      : link.url;
  const isInvalidUrl =
    !isPromoGallery &&
    !isExternalForm &&
    !linkSchema.shape.url.safeParse(displayUrl).success;

  return (
    <div className="space-y-2.5 rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="grid gap-2.5 sm:grid-cols-[auto_1fr_auto_auto_auto_auto] sm:items-center">
        {dragHandle}
        <div>
          <p className="text-sm font-semibold">{displayTitle}</p>
          {isDiscount || isEmbedPost || isForm || isPromoGallery || isExternalForm ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-amber-700">
              {isPromoGallery
                ? labels.promoGalleryType
                : isExternalForm
                  ? labels.externalFormType
                : isDiscount
                  ? labels.discountType
                  : isEmbedPost
                    ? labels.embedType
                    : formTypeLabel} ·{" "}
              {(isDiscount ? discount?.layout : isEmbedPost ? embedPost?.layout : isForm ? form?.layout : "classic") === "featured"
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
        <Button variant="secondary" size="icon" onClick={() => onEdit(link.id)}>
          <SquarePen className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => onOpenSettings(link.id)}>
          <Settings2 className="size-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={() => onDelete(link.id)}>
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
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

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
      embedChecklistTitle: "Activity checklist (local confirmation only)",
      embedChecklistItem1Label: "Followed",
      embedChecklistItem2Label: "Reposted",
      embedChecklistItem3Label: "Commented",
      embedSourceButtonLabel: "Open on source",
      embedSourceButtonUrl: "https://example.com",
      embedSourceButtonOpenInNewTab: true,
      embedSourceButtonEnabled: true,
      embedCtaButtonLabel: "",
      embedCtaUrl: "https://example.com",
      embedCtaButtonOpenInNewTab: true,
      embedCtaButtonEnabled: true,
      embedCloseButtonLabel: "Close",
      embedCloseButtonEnabled: true,
      embedShowModalTitle: true,
      embedShowDescription: true,
      embedShowChecklist: true,
      embedShowChecklistItem1: true,
      embedShowChecklistItem2: true,
      embedShowChecklistItem3: true,
      embedShowSourceButton: true,
      embedShowCtaButton: true,
      embedShowCloseButton: true,
      embedShowTopRightDismissButton: true,
      embedDismissible: true,
      formTemplate: "email_signup",
      formLayout: "classic",
      formTitle: "",
      formIntro: "",
      formOutro: "",
      formSubmitLabel: "Submit",
      formCancelLabel: "Cancel",
      formTermsPlaceholder: "",
      promoTitle: "",
      promoDescription: "",
      promoItems: [],
      externalFormTitle: "",
      externalFormDescription: "",
      externalFormUrl: "",
      externalFormOpenMode: "new_tab",
      externalFormEmbedHtml: "",
      externalFormCtaLabel: "",
      externalFormCloseLabel: "",
      externalFormEnabled: true,
      externalFormShowOpenInBrowserButton: false,
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
      imageBrightness: 100,
      imageContrast: 100,
      imageSaturation: 100,
      overlayOpacity: 0,
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
  const editEmbedShowChecklist = useWatch({ control: editForm.control, name: "embedShowChecklist" });
  const editEmbedShowModalTitle = useWatch({ control: editForm.control, name: "embedShowModalTitle" });
  const editEmbedShowDescription = useWatch({ control: editForm.control, name: "embedShowDescription" });
  const editEmbedShowSourceButton = useWatch({ control: editForm.control, name: "embedShowSourceButton" });
  const editEmbedShowCtaButton = useWatch({ control: editForm.control, name: "embedShowCtaButton" });
  const editEmbedShowCloseButton = useWatch({ control: editForm.control, name: "embedShowCloseButton" });
  const editEmbedShowTopRightDismissButton = useWatch({
    control: editForm.control,
    name: "embedShowTopRightDismissButton",
  });
  const editEmbedShowChecklistItem1 = useWatch({ control: editForm.control, name: "embedShowChecklistItem1" });
  const editEmbedShowChecklistItem2 = useWatch({ control: editForm.control, name: "embedShowChecklistItem2" });
  const editEmbedShowChecklistItem3 = useWatch({ control: editForm.control, name: "embedShowChecklistItem3" });
  const editEmbedSourceButtonEnabled = useWatch({
    control: editForm.control,
    name: "embedSourceButtonEnabled",
  });
  const editEmbedSourceButtonOpenInNewTab = useWatch({
    control: editForm.control,
    name: "embedSourceButtonOpenInNewTab",
  });
  const editEmbedCtaButtonEnabled = useWatch({
    control: editForm.control,
    name: "embedCtaButtonEnabled",
  });
  const editEmbedCtaButtonOpenInNewTab = useWatch({
    control: editForm.control,
    name: "embedCtaButtonOpenInNewTab",
  });
  const editEmbedCloseButtonEnabled = useWatch({
    control: editForm.control,
    name: "embedCloseButtonEnabled",
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
  const editImageBrightness = useWatch({ control: editForm.control, name: "imageBrightness" });
  const editImageContrast = useWatch({ control: editForm.control, name: "imageContrast" });
  const editImageSaturation = useWatch({ control: editForm.control, name: "imageSaturation" });
  const editOverlayOpacity = useWatch({ control: editForm.control, name: "overlayOpacity" });
  const editOpenInNewTab = useWatch({ control: editForm.control, name: "openInNewTab" });
  const editPreserveLineBreaks = useWatch({ control: editForm.control, name: "preserveLineBreaks" });
  const editFormFields = useWatch({ control: editForm.control, name: "formFields" }) ?? [];
  const editPromoItems = useWatch({ control: editForm.control, name: "promoItems" }) ?? [];
  const editExternalFormEnabled = useWatch({ control: editForm.control, name: "externalFormEnabled" });
  const editExternalFormOpenMode = useWatch({ control: editForm.control, name: "externalFormOpenMode" });
  const editExternalFormShowOpenInBrowserButton = useWatch({
    control: editForm.control,
    name: "externalFormShowOpenInBrowserButton",
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
  const editEmbedSourceButtonUrlError = editForm.formState.errors.embedSourceButtonUrl?.message;
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
  const editPromoItemsError = editForm.formState.errors.promoItems?.message as string | undefined;
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
      promoGalleryType: t("links_type_promo_gallery"),
      externalFormType: t("links_type_external_form"),
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
    const promoGallery = getPromoGalleryData(link);
    const externalForm = getExternalFormData(link);
    const isDiscount = getContentType(link) === "discount";
    const isEmbedPost = getContentType(link) === "embed_post";
    const isForm = getContentType(link) === "form";
    const isPromoGallery = getContentType(link) === "promo_gallery";
    const isExternalForm = getContentType(link) === "external_form";
    editForm.reset({
      contentType: getContentType(link),
      title: isDiscount
        ? discount.cardTitle
        : isEmbedPost
          ? embedPost.cardTitle
          : isForm
            ? form.formTitle
            : isPromoGallery
              ? promoGallery.title ?? link.title
            : isExternalForm
              ? externalForm.title ?? link.title
              : link.title,
      url: isDiscount
        ? discount.destinationUrl
        : isEmbedPost
          ? embedPost.ctaUrl
          : isPromoGallery
            ? ""
            : isExternalForm
              ? externalForm.formUrl ?? link.url
              : link.url,
      description: isDiscount
        ? discount.modalDescription
        : isEmbedPost
          ? embedPost.description
          : isForm
            ? form.intro
          : isPromoGallery
            ? promoGallery.description ?? ""
          : isExternalForm
            ? externalForm.description ?? ""
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
      embedChecklistTitle: embedPost.checklistTitle,
      embedChecklistItem1Label: embedPost.checklistItem1Label,
      embedChecklistItem2Label: embedPost.checklistItem2Label,
      embedChecklistItem3Label: embedPost.checklistItem3Label,
      embedSourceButtonLabel: embedPost.sourceButtonLabel,
      embedSourceButtonUrl: embedPost.sourceButtonUrl,
      embedSourceButtonOpenInNewTab: embedPost.sourceButtonOpenInNewTab,
      embedSourceButtonEnabled: embedPost.sourceButtonEnabled,
      embedCtaButtonLabel: embedPost.ctaButtonLabel,
      embedCtaUrl: embedPost.ctaUrl,
      embedCtaButtonOpenInNewTab: embedPost.ctaButtonOpenInNewTab,
      embedCtaButtonEnabled: embedPost.ctaButtonEnabled,
      embedCloseButtonLabel: embedPost.closeButtonLabel,
      embedCloseButtonEnabled: embedPost.closeButtonEnabled,
      embedShowModalTitle: embedPost.showModalTitle,
      embedShowDescription: embedPost.showDescription,
      embedShowChecklist: embedPost.showChecklist,
      embedShowChecklistItem1: embedPost.showChecklistItem1,
      embedShowChecklistItem2: embedPost.showChecklistItem2,
      embedShowChecklistItem3: embedPost.showChecklistItem3,
      embedShowSourceButton: embedPost.showSourceButton,
      embedShowCtaButton: embedPost.showCtaButton,
      embedShowCloseButton: embedPost.showCloseButton,
      embedShowTopRightDismissButton: embedPost.showTopRightDismissButton,
      embedDismissible: embedPost.dismissible,
      formTemplate: form.template,
      formLayout: form.layout,
      formTitle: form.formTitle,
      formIntro: form.intro,
      formOutro: form.outro,
      formSubmitLabel: form.submitLabel,
      formCancelLabel: form.cancelLabel ?? t("form_submit_cancel"),
      formTermsPlaceholder: form.termsPlaceholder ?? "",
      promoTitle: promoGallery.title ?? "",
      promoDescription: promoGallery.description ?? "",
      promoItems: promoGallery.items.map((item) => ({
        id: item.id,
        imageUrl: item.imageUrl ?? "",
        title: item.title ?? "",
        description: item.description ?? "",
        badge: item.badge ?? "",
        conditions: (item.conditions ?? []).map((row) => ({
          id: row.id,
          label: row.label ?? "",
          value: row.value ?? "",
        })),
        ctaLabel: item.ctaLabel ?? "",
        ctaUrl: item.ctaUrl ?? "",
        openInNewTab: item.openInNewTab ?? true,
        active: item.active ?? true,
      })),
      externalFormTitle: externalForm.title ?? "",
      externalFormDescription: externalForm.description ?? "",
      externalFormUrl: isExternalForm ? (externalForm.formUrl ?? "") : "",
      externalFormOpenMode: externalForm.openMode ?? "new_tab",
      externalFormEmbedHtml: externalForm.embedHtml ?? "",
      externalFormCtaLabel: externalForm.ctaLabel ?? "",
      externalFormCloseLabel: externalForm.closeLabel ?? "",
      externalFormEnabled: externalForm.enabled ?? link.enabled,
      externalFormShowOpenInBrowserButton: externalForm.showOpenInBrowserButton ?? false,
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
      imageBrightness: link.settings.imageBrightness ?? 100,
      imageContrast: link.settings.imageContrast ?? 100,
      imageSaturation: link.settings.imageSaturation ?? 100,
      overlayOpacity: link.settings.overlayOpacity ?? 0,
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
    setEditSubmitError(null);
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

  const getFirstValidationMessage = (errors: FieldErrors<LinkFormValues>): string | null => {
    const queue: unknown[] = [errors];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== "object") {
        continue;
      }
      const message =
        "message" in (current as Record<string, unknown>) &&
        typeof (current as { message?: unknown }).message === "string"
          ? (current as { message: string }).message
          : null;
      if (message) {
        return message;
      }
      for (const value of Object.values(current as Record<string, unknown>)) {
        queue.push(value);
      }
    }
    return null;
  };

  const saveEdit = editForm.handleSubmit((values) => {
    if (!editId) {
      return;
    }
    setEditSubmitError(null);
    updateLink(editId, {
      contentType: values.contentType,
      title:
        values.contentType === "discount"
          ? values.cardTitle ?? ""
          : values.contentType === "embed_post"
            ? values.embedCardTitle ?? ""
          : values.contentType === "form"
              ? values.formTitle ?? ""
            : values.contentType === "promo_gallery"
              ? values.promoTitle ?? ""
            : values.contentType === "external_form"
              ? values.externalFormTitle ?? ""
            : values.title ?? "",
      url:
        values.contentType === "discount"
          ? values.destinationUrl ?? ""
          : values.contentType === "embed_post"
            ? values.embedCtaUrl ?? ""
          : values.contentType === "form"
              ? values.url || "https://example.com/form"
            : values.contentType === "promo_gallery"
              ? ""
            : values.contentType === "external_form"
              ? values.externalFormUrl ?? ""
            : values.url ?? "",
      description:
        values.contentType === "discount"
          ? values.modalDescription
          : values.contentType === "embed_post"
            ? values.embedDescription
          : values.contentType === "form"
              ? values.formIntro
            : values.contentType === "promo_gallery"
              ? values.promoDescription ?? ""
            : values.contentType === "external_form"
              ? values.externalFormDescription ?? ""
            : values.description ?? "",
      enabled:
        values.contentType === "external_form"
          ? values.externalFormEnabled ?? values.enabled
          : values.enabled,
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
              checklistTitle: values.embedChecklistTitle ?? "",
              checklistItem1Label: values.embedChecklistItem1Label ?? "",
              checklistItem2Label: values.embedChecklistItem2Label ?? "",
              checklistItem3Label: values.embedChecklistItem3Label ?? "",
              sourceButtonLabel: values.embedSourceButtonLabel ?? "",
              sourceButtonUrl: values.embedSourceButtonUrl ?? "",
              sourceButtonOpenInNewTab: values.embedSourceButtonOpenInNewTab ?? true,
              sourceButtonEnabled: values.embedSourceButtonEnabled ?? true,
              ctaButtonLabel: values.embedCtaButtonLabel ?? "",
              ctaUrl: values.embedCtaUrl ?? "",
              ctaButtonOpenInNewTab: values.embedCtaButtonOpenInNewTab ?? true,
              ctaButtonEnabled: values.embedCtaButtonEnabled ?? true,
              closeButtonLabel: values.embedCloseButtonLabel ?? "Close",
              closeButtonEnabled: values.embedCloseButtonEnabled ?? true,
              showModalTitle: values.embedShowModalTitle ?? true,
              showDescription: values.embedShowDescription ?? true,
              showChecklist: values.embedShowChecklist ?? true,
              showChecklistItem1: values.embedShowChecklistItem1 ?? true,
              showChecklistItem2: values.embedShowChecklistItem2 ?? true,
              showChecklistItem3: values.embedShowChecklistItem3 ?? true,
              showSourceButton: values.embedShowSourceButton ?? true,
              showCtaButton: values.embedShowCtaButton ?? true,
              showCloseButton: values.embedShowCloseButton ?? true,
              showTopRightDismissButton: values.embedShowTopRightDismissButton ?? true,
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
                type: normalizeFormFieldType(field.type),
                required: field.required,
                placeholder: field.placeholder ?? "",
                options: field.options?.map((option) => option.trim()).filter(Boolean) ?? undefined,
              })),
            }
          : undefined,
      promoGallery:
        values.contentType === "promo_gallery"
          ? {
              type: "promo_gallery",
              title: values.promoTitle ?? "",
              description: values.promoDescription ?? "",
              items: (values.promoItems ?? []).map((item) => ({
                id: item.id || `promo-item-${Math.random().toString(36).slice(2, 9)}`,
                imageUrl: item.imageUrl ?? "",
                title: item.title ?? "",
                description: item.description ?? "",
                badge: item.badge ?? "",
                conditions: (item.conditions ?? []).map((row) => ({
                  id: row.id || `promo-condition-${Math.random().toString(36).slice(2, 9)}`,
                  label: row.label ?? "",
                  value: row.value ?? "",
                })),
                ctaLabel: item.ctaLabel ?? "",
                ctaUrl: item.ctaUrl ?? "",
                openInNewTab: item.openInNewTab ?? true,
                active: item.active ?? true,
              })),
            }
          : undefined,
      externalForm:
        values.contentType === "external_form"
          ? {
              type: "external_form",
              title: values.externalFormTitle ?? "",
              description: values.externalFormDescription ?? "",
              formUrl: values.externalFormUrl ?? "",
              openMode: values.externalFormOpenMode ?? "new_tab",
              embedHtml: values.externalFormEmbedHtml ?? "",
              ctaLabel: values.externalFormCtaLabel ?? "",
              closeLabel: values.externalFormCloseLabel ?? "",
              enabled: values.externalFormEnabled ?? values.enabled ?? true,
              showOpenInBrowserButton: values.externalFormShowOpenInBrowserButton ?? false,
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
      imageBrightness: values.imageBrightness ?? 100,
      imageContrast: values.imageContrast ?? 100,
      imageSaturation: values.imageSaturation ?? 100,
      overlayOpacity: values.overlayOpacity ?? 0,
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
    if (values.contentType === "promo_gallery") {
      const firstImage = (values.promoItems ?? []).find((item) => (item.imageUrl ?? "").trim())?.imageUrl;
      updateLinkSettings(editId, {
        thumbnailUrl: firstImage || undefined,
      });
    }
    if (values.contentType === "external_form") {
      updateLinkSettings(editId, {
        thumbnailUrl: undefined,
      });
    }
    setEditId(null);
  }, (errors) => {
    const firstMessage = getFirstValidationMessage(errors);
    setEditSubmitError(firstMessage ?? t("data_tools_toast_action_failed"));
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
        type: "text",
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

  const setPromoItems = (nextItems: NonNullable<LinkFormValues["promoItems"]>) => {
    editForm.setValue("promoItems", nextItems, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const addPromoItem = () => {
    setPromoItems([
      ...editPromoItems,
      {
        id: `promo-item-${Math.random().toString(36).slice(2, 9)}`,
        imageUrl: "",
        title: "",
        description: "",
        badge: "",
        conditions: [],
        ctaLabel: "",
        ctaUrl: "",
        openInNewTab: true,
        active: true,
      },
    ]);
  };

  const removePromoItem = (index: number) => {
    setPromoItems(editPromoItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const movePromoItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= editPromoItems.length) {
      return;
    }
    const next = [...editPromoItems];
    const [current] = next.splice(index, 1);
    next.splice(nextIndex, 0, current);
    setPromoItems(next);
  };

  const updatePromoItem = (
    index: number,
    payload: Partial<NonNullable<LinkFormValues["promoItems"]>[number]>,
  ) => {
    setPromoItems(
      editPromoItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...payload } : item,
      ),
    );
  };

  const addPromoCondition = (itemIndex: number) => {
    const item = editPromoItems[itemIndex];
    if (!item) {
      return;
    }
    updatePromoItem(itemIndex, {
      conditions: [
        ...(item.conditions ?? []),
        {
          id: `promo-condition-${Math.random().toString(36).slice(2, 9)}`,
          label: "",
          value: "",
        },
      ],
    });
  };

  const updatePromoCondition = (
    itemIndex: number,
    conditionIndex: number,
    payload: { label?: string; value?: string },
  ) => {
    const item = editPromoItems[itemIndex];
    if (!item) {
      return;
    }
    const nextConditions = (item.conditions ?? []).map((condition, index) =>
      index === conditionIndex ? { ...condition, ...payload } : condition,
    );
    updatePromoItem(itemIndex, { conditions: nextConditions });
  };

  const removePromoCondition = (itemIndex: number, conditionIndex: number) => {
    const item = editPromoItems[itemIndex];
    if (!item) {
      return;
    }
    updatePromoItem(itemIndex, {
      conditions: (item.conditions ?? []).filter((_, index) => index !== conditionIndex),
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    reorderLinks(String(active.id), String(over.id));
  };

  const handleAddType = (
    type: "link" | "discount" | "embed_post" | "form" | "promo_gallery" | "external_form",
  ) => {
    if (type === "form") {
      setAddPickerStep("form_templates");
      return;
    }
    if (type === "link") {
      addLink(createEmptyLink());
    } else if (type === "discount") {
      addLink(createEmptyDiscountCode());
    } else if (type === "promo_gallery") {
      addLink(createEmptyPromoGallery());
    } else if (type === "external_form") {
      addLink(createEmptyExternalForm());
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
                <Button type="button" variant="outline" onClick={() => handleAddType("promo_gallery")}>
                  {t("links_add_type_promo_gallery")}
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddType("external_form")}>
                  {t("links_add_type_external_form")}
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
          className="overflow-y-auto overflow-x-hidden p-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>{t("links_edit_title")}</SheetTitle>
            <SheetDescription>{t("links_edit_desc")}</SheetDescription>
          </SheetHeader>
          {editingLink && (
            <form
              onSubmit={saveEdit}
              className="space-y-4 overflow-x-hidden px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5"
            >
              {editContentType === "discount" || editContentType === "embed_post" || editContentType === "form" || editContentType === "promo_gallery" || editContentType === "external_form" || editContentType === "link" ? (
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
                        : editContentType === "promo_gallery"
                          ? t("promo_gallery_tabs_settings")
                          : editContentType === "external_form"
                            ? t("external_form_tabs_settings")
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
                        : editContentType === "promo_gallery"
                          ? t("promo_gallery_tabs_layout")
                          : editContentType === "external_form"
                            ? t("external_form_tabs_layout")
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
              ) : editContentType === "promo_gallery" ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t("promo_gallery_helper_block")}
                </p>
              ) : editContentType === "external_form" ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t("external_form_helper_block")}
                </p>
              ) : null}

              {editTab === "link" ? (
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
                          const normalizedFieldType = normalizeFormFieldType(field.type);
                          const needsOptions =
                            normalizedFieldType === "single_select" || normalizedFieldType === "multi_select";
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
                                  value={normalizedFieldType}
                                  onChange={(event) =>
                                    updateFormField(fieldIndex, {
                                      type: event.target.value as NonNullable<LinkFormValues["formFields"]>[number]["type"],
                                      options:
                                        event.target.value === "single_select" ||
                                        event.target.value === "multi_select"
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
                                  <option value="text">{t("form_field_type_text")}</option>
                                  <option value="textarea">{t("form_field_type_textarea")}</option>
                                  <option value="single_select">{t("form_field_type_single_select")}</option>
                                  <option value="multi_select">{t("form_field_type_multi_select")}</option>
                                  <option value="date">{t("form_field_type_date")}</option>
                                  <option value="time">{t("form_field_type_time")}</option>
                                  <option value="image_upload">{t("form_field_type_image_upload")}</option>
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
                                <textarea
                                  className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                                  value={(field.options ?? []).join("\n")}
                                  onChange={(event) =>
                                    updateFormField(fieldIndex, {
                                      options: event.target.value
                                        .split("\n")
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
                  ) : editContentType === "promo_gallery" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("promo_gallery_title_label")}</Label>
                        <Input {...editForm.register("promoTitle")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("promo_gallery_description_label")}</Label>
                        <textarea
                          className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                          {...editForm.register("promoDescription")}
                        />
                      </div>
                      <div className="space-y-3 rounded-xl border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{t("promo_gallery_items_title")}</p>
                          <Button type="button" variant="outline" size="sm" onClick={addPromoItem}>
                            <Plus className="size-4" />
                            {t("promo_gallery_add_item")}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("promo_gallery_image_helper")}</p>
                        {editPromoItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("promo_gallery_items_empty")}</p>
                        ) : null}
                        {editPromoItems.map((item, itemIndex) => (
                          <div key={item.id || `promo-item-${itemIndex}`} className="space-y-2 rounded-lg border p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input
                                value={item.title ?? ""}
                                onChange={(event) => updatePromoItem(itemIndex, { title: event.target.value })}
                                placeholder={t("promo_gallery_item_title")}
                              />
                              <Input
                                value={item.badge ?? ""}
                                onChange={(event) => updatePromoItem(itemIndex, { badge: event.target.value })}
                                placeholder={t("promo_gallery_item_badge")}
                              />
                            </div>
                            <Input
                              value={item.imageUrl ?? ""}
                              onChange={(event) => updatePromoItem(itemIndex, { imageUrl: event.target.value })}
                              placeholder={t("promo_gallery_item_image_url_placeholder")}
                            />
                            <textarea
                              className="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                              value={item.description ?? ""}
                              onChange={(event) => updatePromoItem(itemIndex, { description: event.target.value })}
                              placeholder={t("promo_gallery_item_description")}
                            />
                            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                              <Input
                                value={item.ctaLabel ?? ""}
                                onChange={(event) => updatePromoItem(itemIndex, { ctaLabel: event.target.value })}
                                placeholder={t("promo_gallery_item_cta_label")}
                              />
                              <Input
                                value={item.ctaUrl ?? ""}
                                onChange={(event) => updatePromoItem(itemIndex, { ctaUrl: event.target.value })}
                                placeholder={t("promo_gallery_item_cta_url_placeholder")}
                              />
                              <label className="flex items-center gap-2 text-xs">
                                <Switch
                                  checked={Boolean(item.openInNewTab)}
                                  onCheckedChange={(value) => updatePromoItem(itemIndex, { openInNewTab: value })}
                                />
                                {t("links_style_open_in_new_tab")}
                              </label>
                            </div>
                            <div className="space-y-2 rounded-md border p-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium">{t("promo_gallery_conditions_title")}</p>
                                <Button type="button" variant="ghost" size="sm" onClick={() => addPromoCondition(itemIndex)}>
                                  {t("promo_gallery_add_condition")}
                                </Button>
                              </div>
                              {(item.conditions ?? []).map((condition, conditionIndex) => (
                                <div key={condition.id || `condition-${conditionIndex}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                                  <Input
                                    value={condition.label ?? ""}
                                    onChange={(event) =>
                                      updatePromoCondition(itemIndex, conditionIndex, { label: event.target.value })
                                    }
                                    placeholder={t("promo_gallery_condition_label")}
                                  />
                                  <Input
                                    value={condition.value ?? ""}
                                    onChange={(event) =>
                                      updatePromoCondition(itemIndex, conditionIndex, { value: event.target.value })
                                    }
                                    placeholder={t("promo_gallery_condition_value")}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removePromoCondition(itemIndex, conditionIndex)}
                                  >
                                    {t("form_remove_field")}
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <label className="flex items-center gap-2 text-xs">
                                <Switch
                                  checked={Boolean(item.active)}
                                  onCheckedChange={(value) => updatePromoItem(itemIndex, { active: value })}
                                />
                                {t("links_enabled")}
                              </label>
                              <Button type="button" variant="ghost" size="sm" onClick={() => movePromoItem(itemIndex, -1)}>
                                {t("form_move_up")}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => movePromoItem(itemIndex, 1)}>
                                {t("form_move_down")}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removePromoItem(itemIndex)}>
                                {t("form_remove_field")}
                              </Button>
                            </div>
                          </div>
                        ))}
                        {editPromoItemsError ? (
                          <p className="text-xs text-destructive">{editPromoItemsError}</p>
                        ) : null}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={editEnabled} onCheckedChange={(v) => editForm.setValue("enabled", v)} />
                        {t("links_enabled")}
                      </label>
                    </>
                  ) : editContentType === "external_form" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("external_form_title_label")}</Label>
                        <Input {...editForm.register("externalFormTitle")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("external_form_description_label")}</Label>
                        <textarea
                          className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                          {...editForm.register("externalFormDescription")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("external_form_url_label")}</Label>
                        <Input
                          type="url"
                          placeholder="https://docs.google.com/forms/..."
                          {...editForm.register("externalFormUrl")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("external_form_open_mode_label")}</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          {...editForm.register("externalFormOpenMode")}
                        >
                          <option value="new_tab">{t("external_form_open_mode_new_tab")}</option>
                          <option value="modal">{t("external_form_open_mode_modal")}</option>
                          <option value="embed">{t("external_form_open_mode_embed")}</option>
                        </select>
                      </div>
                      {editExternalFormOpenMode === "modal" || editExternalFormOpenMode === "embed" ? (
                        <div className="space-y-2">
                          <Label>{t("external_form_embed_html_label")}</Label>
                          <textarea
                            className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                            {...editForm.register("externalFormEmbedHtml")}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Label>{t("external_form_cta_label")}</Label>
                        <Input {...editForm.register("externalFormCtaLabel")} />
                      </div>
                      {editExternalFormOpenMode === "modal" || editExternalFormOpenMode === "embed" ? (
                        <>
                          <div className="space-y-2">
                            <Label>{t("external_form_close_label")}</Label>
                            <Input {...editForm.register("externalFormCloseLabel")} />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={Boolean(editExternalFormShowOpenInBrowserButton)}
                              onCheckedChange={(v) =>
                                editForm.setValue("externalFormShowOpenInBrowserButton", v, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                            {t("external_form_show_open_in_browser_button")}
                          </label>
                        </>
                      ) : null}
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={Boolean(editExternalFormEnabled)}
                          onCheckedChange={(v) =>
                            editForm.setValue("externalFormEnabled", v, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
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
                      <div className="space-y-3 rounded-xl border p-3">
                        <p className="text-sm font-medium">{t("embed_post_modal_visibility_title")}</p>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowModalTitle)}
                            onCheckedChange={(v) => editForm.setValue("embedShowModalTitle", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_modal_title")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowDescription)}
                            onCheckedChange={(v) => editForm.setValue("embedShowDescription", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_description")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowChecklist)}
                            onCheckedChange={(v) => editForm.setValue("embedShowChecklist", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_checklist")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowSourceButton)}
                            onCheckedChange={(v) => editForm.setValue("embedShowSourceButton", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_source_button")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowCtaButton)}
                            onCheckedChange={(v) => editForm.setValue("embedShowCtaButton", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_cta_button")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowCloseButton)}
                            onCheckedChange={(v) => editForm.setValue("embedShowCloseButton", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_close_button")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedShowTopRightDismissButton)}
                            onCheckedChange={(v) => editForm.setValue("embedShowTopRightDismissButton", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("embed_post_toggle_show_top_right_dismiss")}
                        </label>
                      </div>

                      <div className="space-y-3 rounded-xl border p-3">
                        <p className="text-sm font-medium">{t("embed_post_checklist_title")}</p>
                        <div className="space-y-2">
                          <Label>{t("embed_post_fields_checklist_title")}</Label>
                          <Input {...editForm.register("embedChecklistTitle")} />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <Input {...editForm.register("embedChecklistItem1Label")} placeholder={t("embed_post_fields_checklist_item_1")} />
                          <label className="flex items-center gap-2 text-xs">
                            <Switch
                              checked={Boolean(editEmbedShowChecklistItem1)}
                              onCheckedChange={(v) => editForm.setValue("embedShowChecklistItem1", v, { shouldDirty: true, shouldValidate: true })}
                            />
                            {t("links_enabled")}
                          </label>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <Input {...editForm.register("embedChecklistItem2Label")} placeholder={t("embed_post_fields_checklist_item_2")} />
                          <label className="flex items-center gap-2 text-xs">
                            <Switch
                              checked={Boolean(editEmbedShowChecklistItem2)}
                              onCheckedChange={(v) => editForm.setValue("embedShowChecklistItem2", v, { shouldDirty: true, shouldValidate: true })}
                            />
                            {t("links_enabled")}
                          </label>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <Input {...editForm.register("embedChecklistItem3Label")} placeholder={t("embed_post_fields_checklist_item_3")} />
                          <label className="flex items-center gap-2 text-xs">
                            <Switch
                              checked={Boolean(editEmbedShowChecklistItem3)}
                              onCheckedChange={(v) => editForm.setValue("embedShowChecklistItem3", v, { shouldDirty: true, shouldValidate: true })}
                            />
                            {t("links_enabled")}
                          </label>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-xl border p-3">
                        <p className="text-sm font-medium">{t("embed_post_source_button_title")}</p>
                        <div className="space-y-2">
                          <Label>{t("embed_post_fields_source_button_label")}</Label>
                          <Input {...editForm.register("embedSourceButtonLabel")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("embed_post_fields_source_button_url")}</Label>
                          <Input
                            type="url"
                            aria-invalid={Boolean(editEmbedSourceButtonUrlError)}
                            className={editEmbedSourceButtonUrlError ? "border-destructive" : undefined}
                            {...editForm.register("embedSourceButtonUrl")}
                          />
                          {editEmbedSourceButtonUrlError ? (
                            <p className="text-xs text-destructive">{editEmbedSourceButtonUrlError}</p>
                          ) : null}
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedSourceButtonOpenInNewTab)}
                            onCheckedChange={(v) => editForm.setValue("embedSourceButtonOpenInNewTab", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("links_style_open_in_new_tab")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={Boolean(editEmbedSourceButtonEnabled)}
                            onCheckedChange={(v) => editForm.setValue("embedSourceButtonEnabled", v, { shouldDirty: true, shouldValidate: true })}
                          />
                          {t("links_enabled")}
                        </label>
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
                          checked={Boolean(editEmbedCtaButtonOpenInNewTab)}
                          onCheckedChange={(v) => editForm.setValue("embedCtaButtonOpenInNewTab", v, { shouldDirty: true, shouldValidate: true })}
                        />
                        {t("links_style_open_in_new_tab")}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={Boolean(editEmbedCtaButtonEnabled)}
                          onCheckedChange={(v) => editForm.setValue("embedCtaButtonEnabled", v, { shouldDirty: true, shouldValidate: true })}
                        />
                        {t("links_enabled")}
                      </label>
                      <div className="space-y-2">
                        <Label>{t("embed_post_fields_close_button_label")}</Label>
                        <Input {...editForm.register("embedCloseButtonLabel")} />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={Boolean(editEmbedCloseButtonEnabled)}
                          onCheckedChange={(v) => editForm.setValue("embedCloseButtonEnabled", v, { shouldDirty: true, shouldValidate: true })}
                        />
                        {t("links_enabled")}
                      </label>
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

              {(editContentType === "discount" || editContentType === "embed_post" || editContentType === "form" || editContentType === "promo_gallery" || editContentType === "external_form" || editContentType === "link") && editTab === "layout" ? (
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
                  {(editStyle === "image_banner" || editStyle === "media_card") ? (
                    <div className="rounded-lg border border-border/70 p-3 space-y-3">
                      <div className="space-y-1">
                        <Label>Image brightness ({editImageBrightness ?? 100}%)</Label>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={1}
                          className="w-full"
                          {...editForm.register("imageBrightness", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Image contrast ({editImageContrast ?? 100}%)</Label>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={1}
                          className="w-full"
                          {...editForm.register("imageContrast", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Image saturation ({editImageSaturation ?? 100}%)</Label>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={1}
                          className="w-full"
                          {...editForm.register("imageSaturation", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Overlay opacity (+{editOverlayOpacity ?? 0}%)</Label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                          {...editForm.register("overlayOpacity", { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Applies to display only. Original image URL is unchanged.
                        </p>
                      </div>
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
                  {editContentType !== "link" && editContentType !== "promo_gallery" && editContentType !== "external_form" ? (
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
                </>
              ) : null}
              {editSubmitError ? (
                <p className="text-sm text-destructive">{editSubmitError}</p>
              ) : null}
              <SheetFooter className="sticky bottom-0 border-t border-border/60 bg-background px-0 py-3">
                <Button type="submit">{t("links_save")}</Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Drawer open={Boolean(settingsId)} onOpenChange={(open) => !open && setSettingsId(null)}>
        <DrawerContent className="mx-auto w-full max-w-xl overflow-y-auto overflow-x-hidden pb-1">
          <DrawerHeader>
            <DrawerTitle>{t("links_settings_title")}</DrawerTitle>
            <DrawerDescription>
              {t("links_settings_desc")}
            </DrawerDescription>
          </DrawerHeader>
          {settingsLink && (
            <form
              onSubmit={saveSettings}
              className="space-y-4 overflow-x-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5"
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
              <DrawerFooter className="sticky bottom-0 border-t border-border/60 bg-background px-0 py-3">
                <Button type="submit">{t("links_save_settings")}</Button>
              </DrawerFooter>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </SectionCard>
  );
};
