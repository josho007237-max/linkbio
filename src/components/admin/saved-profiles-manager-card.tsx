"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockBuilderData } from "@/features/builder/mock-data";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { BuilderData } from "@/features/builder/types";
import { useI18n } from "@/i18n/use-i18n";
import { removeAnalyticsForSlug } from "@/lib/local-storage/analytics-storage";
import { setActiveEditorSlug, toProfileSlug } from "@/lib/local-storage/profile-storage";
import {
  deletePublicPageBySlug,
  listPublicPages,
  type PublicPageListItem,
} from "@/lib/public-pages/public-pages-client";

type SavedProfilesManagerCardProps = {
  currentSlug: string;
  isSwitchingWorkspace?: boolean;
  onSwitchWorkspace?: (slug: string, options?: { fallbackData?: BuilderData; markUnsaved?: boolean }) => Promise<"remote" | "fallback">;
};

type NewPageCollisionState = {
  targetSlug: string;
  pageName: string;
  existingProfile: BuilderData;
};

const createUniqueSlug = (baseSlug: string, existingSlugs: Set<string>) => {
  const initial = toProfileSlug(baseSlug);
  if (!existingSlugs.has(initial)) {
    return initial;
  }

  let index = 2;
  while (existingSlugs.has(`${initial}-${index}`)) {
    index += 1;
  }
  return `${initial}-${index}`;
};

const createPageWorkspaceData = (slug: string, pageName: string): BuilderData => ({
  ...mockBuilderData,
  header: {
    ...mockBuilderData.header,
    username: slug,
    displayName: pageName,
  },
});

export const SavedProfilesManagerCard = ({
  currentSlug,
  isSwitchingWorkspace = false,
  onSwitchWorkspace,
}: SavedProfilesManagerCardProps) => {
  const { t } = useI18n();
  const replaceBuilderData = useBuilderStore((state) => state.replaceBuilderData);
  const [isMounted, setIsMounted] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<PublicPageListItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [createPageName, setCreatePageName] = useState("");
  const [createPageSlug, setCreatePageSlug] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPageCollision, setNewPageCollision] = useState<NewPageCollisionState | null>(null);
  const [pendingActionSlug, setPendingActionSlug] = useState<string | null>(null);
  const activeSlug = useMemo(() => toProfileSlug(currentSlug), [currentSlug]);
  const statusTimerRef = useRef<number | null>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    setStatusMessage({ type, text });
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, 2200);
  }, []);

  const switchWorkspace = useCallback(
    async (slug: string, options?: { fallbackData?: BuilderData; markUnsaved?: boolean }) => {
      if (onSwitchWorkspace) {
        return onSwitchWorkspace(slug, options);
      }
      if (options?.fallbackData) {
        replaceBuilderData(options.fallbackData);
      }
      setActiveEditorSlug(slug);
      return options?.fallbackData ? "fallback" : "remote";
    },
    [onSwitchWorkspace, replaceBuilderData],
  );

  const refreshSavedPages = useCallback(async () => {
    try {
      const pages = await listPublicPages();
      setSavedProfiles(pages);
      return pages;
    } catch {
      showToast("error", t("saved_manager_toast_load_error"));
      return null;
    }
  }, [showToast, t]);

  useEffect(() => {
    const mountFrameId = window.requestAnimationFrame(() => {
      setIsMounted(true);
      void refreshSavedPages();
    });

    const onStorage = () => {
      void refreshSavedPages();
    };
    window.addEventListener("storage", onStorage);
    const intervalId = window.setInterval(onStorage, 3000);

    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
      window.cancelAnimationFrame(mountFrameId);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, [refreshSavedPages]);

  const handleCopyLink = async (slug: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    const publicUrl = `${window.location.origin}/${slug}`;
    await navigator.clipboard.writeText(publicUrl);
    setCopiedSlug(slug);
    window.setTimeout(() => setCopiedSlug(null), 1800);
  };

  const handleLoadIntoEditor = async (slug: string) => {
    if (isSwitchingWorkspace) {
      return;
    }
    setPendingActionSlug(slug);
    try {
      const result = await switchWorkspace(slug);
      if (result === "fallback") {
        showToast("error", t("saved_manager_toast_load_missing", { slug }));
        return;
      }
      showToast("success", t("saved_manager_toast_loaded", { slug }));
    } catch {
      showToast("error", t("saved_manager_toast_load_error"));
    } finally {
      setPendingActionSlug(null);
    }
  };

  const handleCreateWorkspace = (slug: string, pageName: string) => {
    if (isSwitchingWorkspace) {
      return;
    }
    const normalizedSlug = toProfileSlug(slug);
    const normalizedPageName = pageName.trim() || normalizedSlug;
    const pageWorkspace = createPageWorkspaceData(normalizedSlug, normalizedPageName);

    setPendingActionSlug(normalizedSlug);
    void (async () => {
      try {
        await switchWorkspace(normalizedSlug, { fallbackData: pageWorkspace, markUnsaved: true });
        showToast("success", t("saved_manager_toast_created", { slug: normalizedSlug }));
      } finally {
        setPendingActionSlug(null);
      }
    })();
  };

  const handleDuplicateIntoEditor = (profile: BuilderData, slug: string) => {
    if (isSwitchingWorkspace) {
      return;
    }
    const existingSlugs = new Set(savedProfiles.map((item) => item.slug));
    existingSlugs.add(activeSlug);
    const duplicateSlug = createUniqueSlug(`${slug}-copy`, existingSlugs);
    const duplicateProfile: BuilderData = {
      ...profile,
      header: {
        ...profile.header,
        username: duplicateSlug,
        displayName: `${profile.header.displayName} Copy`,
      },
    };

    setPendingActionSlug(slug);
    void (async () => {
      try {
        await switchWorkspace(duplicateSlug, {
          fallbackData: duplicateProfile,
          markUnsaved: true,
        });
        showToast("success", t("saved_manager_toast_duplicated", { slug: duplicateSlug }));
      } finally {
        setPendingActionSlug(null);
      }
    })();
  };

  const handleCreateNewPage = () => {
    const slug = toProfileSlug(createPageSlug);
    const pageName = createPageName.trim();
    if (!slug || !pageName) {
      showToast("error", t("saved_manager_toast_create_missing"));
      return;
    }

    const existingProfile = savedProfiles.find((item) => item.slug === slug);
    if (existingProfile) {
      setNewPageCollision({
        targetSlug: slug,
        pageName,
        existingProfile: existingProfile.data,
      });
      return;
    }

    handleCreateWorkspace(slug, pageName);
    setShowCreateDialog(false);
    setCreatePageName("");
    setCreatePageSlug("");
  };

  const handleDuplicateFromCollision = () => {
    if (!newPageCollision) {
      return;
    }

    const existingSlugs = new Set(savedProfiles.map((item) => item.slug));
    existingSlugs.add(activeSlug);
    const duplicateSlug = createUniqueSlug(`${newPageCollision.targetSlug}-copy`, existingSlugs);
    handleCreateWorkspace(duplicateSlug, newPageCollision.pageName);
    setShowCreateDialog(false);
    setCreatePageName("");
    setCreatePageSlug("");
    setNewPageCollision(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteSlug || isSwitchingWorkspace) {
      return;
    }

    const targetSlug = deleteSlug;
    setPendingActionSlug(targetSlug);

    try {
      await deletePublicPageBySlug(targetSlug);
      removeAnalyticsForSlug(targetSlug);

      const pages = (await refreshSavedPages()) ?? [];
      if (targetSlug === activeSlug) {
        const fallbackPage = pages.find((item) => item.slug !== targetSlug) ?? null;
        if (fallbackPage) {
          await switchWorkspace(fallbackPage.slug);
        } else {
          const nextSlug = createUniqueSlug(`${targetSlug}-new`, new Set([targetSlug]));
          const nextWorkspace = createPageWorkspaceData(nextSlug, t("saved_manager_new_page_default"));
          await switchWorkspace(nextSlug, { fallbackData: nextWorkspace, markUnsaved: true });
        }
      }

      setDeleteSlug(null);
      setDeleteConfirmInput("");
      showToast("success", t("saved_manager_toast_deleted", { slug: targetSlug }));
      window.dispatchEvent(new Event("storage"));
    } catch {
      showToast("error", t("saved_manager_toast_delete_error"));
    } finally {
      setPendingActionSlug(null);
    }
  };

  return (
    <>
      <Card className="border-border/70 bg-muted/35 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("saved_manager_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-xs text-muted-foreground">
            <p>{t("saved_manager_current_page", { slug: activeSlug })}</p>
            <p className="mt-1">{t("saved_manager_saved_pages")}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={isSwitchingWorkspace}
            onClick={() => {
              setShowCreateDialog(true);
              setNewPageCollision(null);
            }}
          >
            {t("saved_manager_create")}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("saved_manager_help_1")}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("saved_manager_help_2")}
          </p>
          {!isMounted || savedProfiles.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {t("saved_manager_empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {savedProfiles.map((item) => {
                const isBusy = pendingActionSlug === item.slug;
                const isActive = item.slug === activeSlug;
                return (
                  <div key={item.slug} className="rounded-lg border bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">/{item.slug}</p>
                      {isActive ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {t("saved_manager_current")}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.data.header.displayName}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={isBusy || isSwitchingWorkspace}
                        onClick={() => {
                          void handleLoadIntoEditor(item.slug);
                        }}
                      >
                        {isBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                        {t("saved_manager_load")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          window.open(`/${item.slug}`, "_blank", "noopener,noreferrer")
                        }
                      >
                        {t("saved_manager_open")}
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          void handleCopyLink(item.slug);
                        }}
                      >
                        {copiedSlug === item.slug ? t("saved_manager_copied") : t("saved_manager_copy")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={isBusy || isSwitchingWorkspace}
                        onClick={() => handleDuplicateIntoEditor(item.data, item.slug)}
                      >
                        {t("saved_manager_duplicate")}
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={isSwitchingWorkspace}
                      onClick={() => {
                        setDeleteSlug(item.slug);
                        setDeleteConfirmInput("");
                      }}
                    >
                      {t("saved_manager_delete")}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {showCreateDialog ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold">{t("saved_manager_create_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("saved_manager_create_desc")}
            </p>
            <div className="mt-4 space-y-1">
              <label htmlFor="create-page-name" className="text-xs text-muted-foreground">
                {t("saved_manager_create_name")}
              </label>
              <Input
                id="create-page-name"
                value={createPageName}
                onChange={(event) => setCreatePageName(event.target.value)}
                placeholder={t("saved_manager_create_name_placeholder")}
              />
            </div>
            <div className="mt-3 space-y-1">
              <label htmlFor="create-page-slug" className="text-xs text-muted-foreground">
                {t("saved_manager_create_slug")}
              </label>
              <Input
                id="create-page-slug"
                value={createPageSlug}
                onChange={(event) => setCreatePageSlug(toProfileSlug(event.target.value))}
                placeholder="my-page"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateDialog(false);
                  setCreatePageName("");
                  setCreatePageSlug("");
                  setNewPageCollision(null);
                }}
              >
                {t("saved_manager_cancel")}
              </Button>
              <Button onClick={handleCreateNewPage} disabled={isSwitchingWorkspace}>
                {t("saved_manager_create_confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {newPageCollision ? (
        <div className="fixed inset-0 z-[86] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold">{t("saved_manager_collision_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("saved_manager_collision_desc", { slug: newPageCollision.targetSlug })}
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                variant="secondary"
                disabled={isSwitchingWorkspace}
                onClick={() => {
                  void handleLoadIntoEditor(newPageCollision.targetSlug);
                  setShowCreateDialog(false);
                  setCreatePageName("");
                  setCreatePageSlug("");
                  setNewPageCollision(null);
                }}
              >
                {t("saved_manager_collision_load")}
              </Button>
              <Button variant="outline" onClick={handleDuplicateFromCollision} disabled={isSwitchingWorkspace}>
                {t("saved_manager_collision_duplicate")}
              </Button>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setNewPageCollision(null)}>
                {t("saved_manager_cancel")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteSlug ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold">{t("saved_manager_delete_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("saved_manager_delete_desc", { slug: deleteSlug })}
            </p>
            <div className="mt-3 space-y-1">
              <label htmlFor="delete-route-confirm" className="text-xs text-muted-foreground">
                {t("saved_manager_delete_exact_slug")}
              </label>
              <Input
                id="delete-route-confirm"
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                placeholder={`/${deleteSlug}`}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteSlug(null);
                  setDeleteConfirmInput("");
                }}
              >
                {t("saved_manager_cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void handleConfirmDelete();
                }}
                disabled={deleteConfirmInput !== `/${deleteSlug}` || isSwitchingWorkspace}
              >
                {t("saved_manager_confirm_delete")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {statusMessage ? (
        <div className="fixed right-4 bottom-4 z-[95]">
          <div
            className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${
              statusMessage.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {statusMessage.text}
          </div>
        </div>
      ) : null}
    </>
  );
};
