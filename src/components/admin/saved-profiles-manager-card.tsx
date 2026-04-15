"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { BuilderData } from "@/features/builder/types";
import { useI18n } from "@/i18n/use-i18n";
import { removeAnalyticsForSlug } from "@/lib/local-storage/analytics-storage";
import {
  getSavedProfilesFromLocal,
  removeProfileBySlug,
  setActiveEditorSlug,
  toProfileSlug,
} from "@/lib/local-storage/profile-storage";

type SavedProfilesManagerCardProps = {
  username: string;
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

export const SavedProfilesManagerCard = ({
  username,
}: SavedProfilesManagerCardProps) => {
  const { t } = useI18n();
  const replaceBuilderData = useBuilderStore((state) => state.replaceBuilderData);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [pendingActionSlug, setPendingActionSlug] = useState<string | null>(null);
  const activeSlug = useMemo(() => toProfileSlug(username), [username]);
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mountFrameId = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });
    const onStorage = () => setRefreshKey((value) => value + 1);
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
  }, []);

  const showToast = (type: "success" | "error", text: string) => {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    setStatusMessage({ type, text });
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, 2200);
  };

  const savedProfiles = useMemo(() => {
    if (!isMounted) {
      return [];
    }
    void refreshKey;
    return getSavedProfilesFromLocal();
  }, [isMounted, refreshKey]);

  const handleCopyLink = async (slug: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    const publicUrl = `${window.location.origin}/${slug}`;
    await navigator.clipboard.writeText(publicUrl);
    setCopiedSlug(slug);
    window.setTimeout(() => setCopiedSlug(null), 1800);
  };

  const handleLoadIntoEditor = (profile: BuilderData, slug: string) => {
    setPendingActionSlug(slug);
    window.requestAnimationFrame(() => {
      replaceBuilderData(profile);
      setActiveEditorSlug(slug);
      setPendingActionSlug(null);
      showToast("success", t("saved_manager_toast_loaded", { slug }));
    });
  };

  const handleDuplicateIntoEditor = (profile: BuilderData, slug: string) => {
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
    window.requestAnimationFrame(() => {
      replaceBuilderData(duplicateProfile);
      setActiveEditorSlug(duplicateSlug);
      setPendingActionSlug(null);
      showToast("success", t("saved_manager_toast_duplicated", { slug: duplicateSlug }));
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteSlug) {
      return;
    }

    removeProfileBySlug(deleteSlug);
    removeAnalyticsForSlug(deleteSlug);
    window.dispatchEvent(new Event("storage"));
    setDeleteSlug(null);
    setDeleteConfirmInput("");
    showToast("success", t("saved_manager_toast_deleted", { slug: deleteSlug }));
  };

  return (
    <>
      <Card className="border-border/70 bg-muted/35 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("saved_manager_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {t("saved_manager_help_1")}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("saved_manager_help_2")}
          </p>
          {savedProfiles.length === 0 ? (
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
                        disabled={isBusy}
                        onClick={() => handleLoadIntoEditor(item.data, item.slug)}
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
                        onClick={() => handleCopyLink(item.slug)}
                      >
                        {copiedSlug === item.slug ? t("saved_manager_copied") : t("saved_manager_copy")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={isBusy}
                        onClick={() => handleDuplicateIntoEditor(item.data, item.slug)}
                      >
                        {t("saved_manager_duplicate")}
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
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
                placeholder={deleteSlug}
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
                onClick={handleConfirmDelete}
                disabled={deleteConfirmInput !== deleteSlug}
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
