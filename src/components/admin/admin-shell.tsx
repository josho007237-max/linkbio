"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { EditorPanel } from "@/components/admin/editor-panel";
import { SaveStatus, SaveStatusBar } from "@/components/admin/save-status-bar";
import { MobilePreview } from "@/components/preview/mobile-preview";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";
import { BuilderData } from "@/features/builder/types";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import {
  clearStaleLocalStorageKeysOnce,
  getActiveEditorSlug,
  getSavedProfileBySlug,
  getSavedProfilesFromLocal,
  setActiveEditorSlug,
  toProfileSlug,
  upsertProfileIndex,
} from "@/lib/local-storage/profile-storage";

type CollisionDialogState = {
  targetSlug: string;
  existingProfile: BuilderData;
  pendingPayload: BuilderData;
  pendingSnapshot: string;
};

const getUniqueSlug = (baseSlug: string, existingSlugs: Set<string>) => {
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }
  let index = 2;
  while (existingSlugs.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}`;
};

export const AdminShell = () => {
  const { t } = useI18n();
  const storageWarningMessage = t("storage_warning_quota");
  const header = useBuilderStore((state) => state.header);
  const theme = useBuilderStore((state) => state.theme);
  const text = useBuilderStore((state) => state.text);
  const buttonStyle = useBuilderStore((state) => state.buttonStyle);
  const socials = useBuilderStore((state) => state.socials);
  const links = useBuilderStore((state) => state.links);
  const replaceBuilderData = useBuilderStore((state) => state.replaceBuilderData);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [collisionDialog, setCollisionDialog] = useState<CollisionDialogState | null>(null);
  const [currentEditorSlug, setCurrentEditorSlug] = useState(toProfileSlug(header.username));
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const previousSlugRef = useRef<string>(toProfileSlug(header.username));
  const lastSavedSnapshotRef = useRef<string>("");
  const hasInitializedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveOperationTimerRef = useRef<number | null>(null);

  const builderData = useMemo<BuilderData>(
    () => ({ header, theme, text, buttonStyle, socials, links }),
    [buttonStyle, header, links, socials, text, theme],
  );

  const persistProfile = useCallback((payload: BuilderData, snapshot: string) => {
    if (saveOperationTimerRef.current) {
      window.clearTimeout(saveOperationTimerRef.current);
    }

    const nextSlug = toProfileSlug(payload.header.username);
    const previousSlug = previousSlugRef.current;
    const existingProfile = getSavedProfileBySlug(nextSlug);
    const hasCollision = Boolean(existingProfile && nextSlug !== previousSlug);

    if (hasCollision && existingProfile) {
      setCollisionDialog((current) => {
        if (current && current.targetSlug === nextSlug) {
          return {
            ...current,
            existingProfile,
            pendingPayload: payload,
            pendingSnapshot: snapshot,
          };
        }
        return {
          targetSlug: nextSlug,
          existingProfile,
          pendingPayload: payload,
          pendingSnapshot: snapshot,
        };
      });
      setSaveStatus("unsaved");
      return;
    }

    setCollisionDialog(null);
    setSaveStatus("saving");
    saveOperationTimerRef.current = window.setTimeout(() => {
      upsertProfileIndex(payload, previousSlug);
      previousSlugRef.current = nextSlug;
      setCurrentEditorSlug(nextSlug);
      setActiveEditorSlug(nextSlug);
      lastSavedSnapshotRef.current = snapshot;
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      window.dispatchEvent(new Event("storage"));
      setProfileRefreshKey((value) => value + 1);
      saveOperationTimerRef.current = null;
    }, 180);
  }, []);

  const handleSaveNow = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const snapshot = JSON.stringify(builderData);
    persistProfile(builderData, snapshot);
  }, [builderData, persistProfile]);

  useEffect(() => {
    let syncFrameId: number | null = null;
    clearStaleLocalStorageKeysOnce();
    const activeSlug = getActiveEditorSlug();
    const resolvedSlug = activeSlug ?? previousSlugRef.current;
    const savedWorkspace = getSavedProfileBySlug(resolvedSlug);

    if (savedWorkspace) {
      previousSlugRef.current = resolvedSlug;
      const savedSnapshot = JSON.stringify(savedWorkspace);
      lastSavedSnapshotRef.current = savedSnapshot;
      useBuilderStore.getState().replaceBuilderData(savedWorkspace);
      syncFrameId = window.requestAnimationFrame(() => {
        setCurrentEditorSlug(resolvedSlug);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setIsWorkspaceReady(true);
      });
    } else {
      previousSlugRef.current = resolvedSlug;
      setActiveEditorSlug(resolvedSlug);
      syncFrameId = window.requestAnimationFrame(() => {
        setCurrentEditorSlug(resolvedSlug);
        setIsWorkspaceReady(true);
      });
    }

    const onStorage = () => setProfileRefreshKey((value) => value + 1);
    const onStorageWarning = () => {
      setStorageWarning(storageWarningMessage);
      window.setTimeout(() => {
        setStorageWarning((current) =>
          current === storageWarningMessage ? null : current,
        );
      }, 2600);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("linkbio-storage-warning", onStorageWarning);
    const intervalId = window.setInterval(onStorage, 2500);

    return () => {
      if (syncFrameId) {
        window.cancelAnimationFrame(syncFrameId);
      }
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("linkbio-storage-warning", onStorageWarning);
      window.clearInterval(intervalId);
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      if (saveOperationTimerRef.current) {
        window.clearTimeout(saveOperationTimerRef.current);
      }
    };
  }, [storageWarningMessage]);

  useEffect(() => {
    const activeSlug = getActiveEditorSlug();
    if (activeSlug) {
      previousSlugRef.current = activeSlug;
      const frameId = window.requestAnimationFrame(() => {
        setCurrentEditorSlug(activeSlug);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [profileRefreshKey]);

  useEffect(() => {
    if (!isWorkspaceReady) {
      return;
    }

    const snapshot = JSON.stringify(builderData);

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (snapshot === lastSavedSnapshotRef.current) {
        return;
      }
      const initFrameId = window.requestAnimationFrame(() => {
        persistProfile(builderData, snapshot);
      });
      return () => {
        window.cancelAnimationFrame(initFrameId);
      };
    }

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveOperationTimerRef.current) {
      window.clearTimeout(saveOperationTimerRef.current);
      saveOperationTimerRef.current = null;
    }

    const frameId = window.requestAnimationFrame(() => {
      setSaveStatus("unsaved");
    });

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      persistProfile(builderData, snapshot);
      autosaveTimerRef.current = null;
    }, 800);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [builderData, isWorkspaceReady, persistProfile]);

  const slugCollisionWarning = useMemo(() => {
    void profileRefreshKey;
    const candidate = toProfileSlug(header.username);
    if (!candidate || candidate === currentEditorSlug) {
      return null;
    }
    return getSavedProfileBySlug(candidate) ? candidate : null;
  }, [currentEditorSlug, header.username, profileRefreshKey]);

  const handleLoadExistingRoute = () => {
    if (!collisionDialog) {
      return;
    }
    const loaded = collisionDialog.existingProfile;
    replaceBuilderData(loaded);
    const nextSlug = toProfileSlug(loaded.header.username);
    previousSlugRef.current = nextSlug;
    setCurrentEditorSlug(nextSlug);
    setActiveEditorSlug(nextSlug);
    const snapshot = JSON.stringify(loaded);
    lastSavedSnapshotRef.current = snapshot;
    setLastSavedAt(new Date());
    setSaveStatus("saved");
    setCollisionDialog(null);
  };

  const handleDuplicateIntoNewSlug = () => {
    if (!collisionDialog) {
      return;
    }
    const existingSlugs = new Set(getSavedProfilesFromLocal().map((item) => item.slug));
    const duplicateSlug = getUniqueSlug(`${collisionDialog.targetSlug}-copy`, existingSlugs);
    const duplicated: BuilderData = {
      ...collisionDialog.pendingPayload,
      header: {
        ...collisionDialog.pendingPayload.header,
        username: duplicateSlug,
      },
    };
    replaceBuilderData(duplicated);
    setCurrentEditorSlug(duplicateSlug);
    setActiveEditorSlug(duplicateSlug);
    setSaveStatus("unsaved");
    setCollisionDialog(null);
  };

  return (
    <>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e6edf9,_transparent_35%),radial-gradient(circle_at_top_right,_#e8f4ed,_transparent_32%),linear-gradient(to_bottom,_var(--background),_var(--muted))] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3 xl:col-span-2">
          <div className="lg:sticky lg:top-4 rounded-3xl border border-border/60 bg-gradient-to-b from-background/95 to-muted/35 p-2 shadow-sm backdrop-blur">
            <AdminSidebar currentSlug={currentEditorSlug} />
          </div>
        </div>

        <div className="lg:col-span-6 xl:col-span-6">
          <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-background/95 to-muted/25 p-3 shadow-sm sm:p-4">
            <SaveStatusBar
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              onSaveNow={handleSaveNow}
            />
            <EditorPanel slugCollisionWarning={slugCollisionWarning} />
          </div>
        </div>

        <div className="lg:col-span-3 xl:col-span-4">
          <div className="lg:sticky lg:top-4 rounded-3xl border border-border/60 bg-gradient-to-b from-background/95 to-muted/20 p-2 shadow-sm">
            <MobilePreview data={builderData} mode="admin" />
          </div>
        </div>
      </div>
      </main>
      {collisionDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold">{t("collision_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("collision_line_1", { slug: collisionDialog.targetSlug })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("collision_line_2")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("collision_line_3")}
            </p>
            <div className="mt-4 grid gap-2">
              <Button variant="secondary" onClick={handleLoadExistingRoute}>
                {t("collision_load_existing")}
              </Button>
              <Button variant="outline" onClick={handleDuplicateIntoNewSlug}>
                {t("collision_duplicate_new")}
              </Button>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setCollisionDialog(null);
                }}
              >
                {t("collision_cancel")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {storageWarning ? (
        <div className="fixed right-4 bottom-4 z-[96] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-lg">
          {storageWarning}
        </div>
      ) : null}
    </>
  );
};
