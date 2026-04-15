"use client";

import { AlertTriangle, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { builderDataSchema } from "@/features/builder/schema";
import { useBuilderStore } from "@/features/builder/store/use-builder-store";
import { BuilderData } from "@/features/builder/types";
import { normalizeBuilderData } from "@/features/builder/utils";
import { useI18n } from "@/i18n/use-i18n";
import {
  ANALYTICS_KEY,
  clearAnalyticsStore,
  removeAnalyticsForSlug,
} from "@/lib/local-storage/analytics-storage";
import {
  BUILDER_STORE_KEY,
  PROFILE_INDEX_KEY,
  clearProfileIndex,
  removeProfileBySlug,
  toProfileSlug,
} from "@/lib/local-storage/profile-storage";
import {
  getSafetySettings,
  setSafetySettings,
  type SafetySettings,
} from "@/lib/local-storage/safety-settings";

const RESET_BACKUP_KEY = "linkbio-reset-backup-v1";
const STRONG_CONFIRM_TEXT = "CLEAR ALL";

type ResetBackupEnvelope = {
  createdAt: string;
  data: BuilderData;
  builderStoreRaw: string | null;
  profileIndexRaw: string | null;
  analyticsRaw: string | null;
};

type ConfirmAction = "resetEditor" | "clearCurrentRoute" | "clearAllData" | null;

export const DataToolsCard = () => {
  const { t } = useI18n();
  const header = useBuilderStore((state) => state.header);
  const theme = useBuilderStore((state) => state.theme);
  const text = useBuilderStore((state) => state.text);
  const buttonStyle = useBuilderStore((state) => state.buttonStyle);
  const socials = useBuilderStore((state) => state.socials);
  const links = useBuilderStore((state) => state.links);
  const replaceBuilderData = useBuilderStore((state) => state.replaceBuilderData);
  const resetBuilderData = useBuilderStore((state) => state.resetBuilderData);

  const inputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [strongConfirmText, setStrongConfirmText] = useState("");
  const [clearCurrentConfirmText, setClearCurrentConfirmText] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [backupRefreshKey, setBackupRefreshKey] = useState(0);
  const statusTimerRef = useRef<number | null>(null);
  const currentSlug = useMemo(() => toProfileSlug(header.username), [header.username]);

  const data = useMemo(
    () => ({ header, theme, text, buttonStyle, socials, links }),
    [buttonStyle, header, links, socials, text, theme],
  );

  useEffect(() => {
    const mountFrameId = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });
    const onStorage = () => setBackupRefreshKey((value) => value + 1);
    window.addEventListener("storage", onStorage);

    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
      window.cancelAnimationFrame(mountFrameId);
      window.removeEventListener("storage", onStorage);
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

  const backupSnapshot = useMemo<ResetBackupEnvelope | null>(() => {
    if (!isMounted || typeof window === "undefined") {
      return null;
    }

    void backupRefreshKey;
    const raw = window.localStorage.getItem(RESET_BACKUP_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ResetBackupEnvelope>;
      const validation = builderDataSchema.safeParse(parsed.data);
      if (!validation.success || !parsed.createdAt) {
        return null;
      }

      return {
        createdAt: parsed.createdAt,
        data: normalizeBuilderData(validation.data as BuilderData),
        builderStoreRaw:
          typeof parsed.builderStoreRaw === "string" || parsed.builderStoreRaw === null
            ? parsed.builderStoreRaw
            : null,
        profileIndexRaw:
          typeof parsed.profileIndexRaw === "string" || parsed.profileIndexRaw === null
            ? parsed.profileIndexRaw
            : null,
        analyticsRaw:
          typeof parsed.analyticsRaw === "string" || parsed.analyticsRaw === null
            ? parsed.analyticsRaw
            : null,
      };
    } catch {
      return null;
    }
  }, [backupRefreshKey, isMounted]);

  const safetySettings = useMemo<SafetySettings>(() => {
    if (!isMounted) {
      return { enabled: false, pin: "" };
    }
    void backupRefreshKey;
    return getSafetySettings();
  }, [backupRefreshKey, isMounted]);

  useEffect(() => {
    setPinDraft(safetySettings.pin);
  }, [safetySettings.pin]);

  const handleExport = () => {
    const fileName = `linkbio-settings-${header.username || "profile"}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("success", t("data_tools_toast_exported"));
  };

  const handleImportClick = () => {
    inputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const validation = builderDataSchema.safeParse(parsed);

      if (!validation.success) {
        showToast("error", t("data_tools_toast_import_format_error"));
        return;
      }

      replaceBuilderData(normalizeBuilderData(validation.data as BuilderData));
      showToast("success", t("data_tools_toast_imported"));
    } catch {
      showToast("error", t("data_tools_toast_import_read_error"));
    } finally {
      event.target.value = "";
    }
  };

  const createBackupSnapshot = () => {
    if (typeof window === "undefined") {
      return;
    }

    const backup: ResetBackupEnvelope = {
      createdAt: new Date().toISOString(),
      data,
      builderStoreRaw: window.localStorage.getItem(BUILDER_STORE_KEY),
      profileIndexRaw: window.localStorage.getItem(PROFILE_INDEX_KEY),
      analyticsRaw: window.localStorage.getItem(ANALYTICS_KEY),
    };
    window.localStorage.setItem(RESET_BACKUP_KEY, JSON.stringify(backup));
  };

  const handleConfirmResetEditor = () => {
    createBackupSnapshot();

    resetBuilderData();
    setConfirmAction(null);
    setStrongConfirmText("");
    setClearCurrentConfirmText("");
    setConfirmPinInput("");
    setBackupRefreshKey((value) => value + 1);
    window.dispatchEvent(new Event("storage"));
    showToast("success", t("data_tools_toast_reset_done"));
  };

  const handleConfirmClearCurrentRoute = () => {
    if (typeof window === "undefined") {
      return;
    }

    createBackupSnapshot();
    removeProfileBySlug(currentSlug);
    removeAnalyticsForSlug(currentSlug);
    resetBuilderData();

    setConfirmAction(null);
    setStrongConfirmText("");
    setClearCurrentConfirmText("");
    setConfirmPinInput("");
    setBackupRefreshKey((value) => value + 1);
    window.dispatchEvent(new Event("storage"));
    showToast("success", t("data_tools_toast_clear_current_done"));
  };

  const handleConfirmClearAllData = () => {
    if (typeof window === "undefined") {
      return;
    }

    createBackupSnapshot();
    clearProfileIndex();
    clearAnalyticsStore();
    window.localStorage.removeItem(BUILDER_STORE_KEY);
    resetBuilderData();

    setConfirmAction(null);
    setStrongConfirmText("");
    setClearCurrentConfirmText("");
    setConfirmPinInput("");
    setBackupRefreshKey((value) => value + 1);
    window.dispatchEvent(new Event("storage"));
    showToast("success", t("data_tools_toast_clear_all_done"));
  };

  const handleRestoreBackup = () => {
    if (!backupSnapshot) {
      showToast("error", t("data_tools_toast_restore_missing"));
      return;
    }

    replaceBuilderData(backupSnapshot.data);
    if (backupSnapshot.builderStoreRaw === null) {
      window.localStorage.removeItem(BUILDER_STORE_KEY);
    } else {
      window.localStorage.setItem(BUILDER_STORE_KEY, backupSnapshot.builderStoreRaw);
    }

    if (backupSnapshot.profileIndexRaw === null) {
      window.localStorage.removeItem(PROFILE_INDEX_KEY);
    } else {
      window.localStorage.setItem(PROFILE_INDEX_KEY, backupSnapshot.profileIndexRaw);
    }

    if (backupSnapshot.analyticsRaw === null) {
      window.localStorage.removeItem(ANALYTICS_KEY);
    } else {
      window.localStorage.setItem(ANALYTICS_KEY, backupSnapshot.analyticsRaw);
    }

    window.dispatchEvent(new Event("storage"));
    setBackupRefreshKey((value) => value + 1);
    showToast("success", t("data_tools_toast_restore_done"));
  };

  const isPinRequiredForConfirm =
    safetySettings.enabled &&
    (confirmAction === "clearCurrentRoute" || confirmAction === "clearAllData");
  const isPinValid = !isPinRequiredForConfirm || confirmPinInput === safetySettings.pin;
  const clearCurrentExpectedText = `/${currentSlug}`;

  return (
    <>
      <Card className="border-border/70 bg-muted/35 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("data_tools_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <p className="text-sm font-medium">{t("data_tools_pin_title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
              {t("data_tools_pin_desc")}
              </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={safetySettings.enabled}
                onChange={(event) =>
                  setSafetySettings({
                    enabled: event.target.checked,
                    pin: pinDraft,
                  })
                }
              />
              {t("data_tools_pin_enable")}
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                type="password"
                value={pinDraft}
                onChange={(event) => setPinDraft(event.target.value)}
                placeholder={t("data_tools_pin_placeholder")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSafetySettings({
                    enabled: safetySettings.enabled,
                    pin: pinDraft,
                  })
                }
              >
                {t("data_tools_pin_save")}
              </Button>
            </div>
          </div>
          <Button variant="secondary" className="w-full justify-start" onClick={handleExport}>
            <Download className="size-4" />
            {t("data_tools_export")}
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleImportClick}>
            <Upload className="size-4" />
            {t("data_tools_import")}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setConfirmAction("resetEditor")}
          >
            <RotateCcw className="size-4" />
            {t("data_tools_reset_editor")}
          </Button>
          <p className="px-1 text-xs text-muted-foreground">
            {t("data_tools_reset_help")}
          </p>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleRestoreBackup}
            disabled={!backupSnapshot}
          >
            <RotateCcw className="size-4" />
            {t("data_tools_restore_backup")}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
            onClick={() => setConfirmAction("clearCurrentRoute")}
          >
            <Trash2 className="size-4" />
            {t("data_tools_clear_current")}
          </Button>
          <p className="px-1 text-xs text-muted-foreground">
            {t("data_tools_clear_current_help")}
          </p>
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={() => setConfirmAction("clearAllData")}
          >
            <AlertTriangle className="size-4" />
            {t("data_tools_clear_all")}
          </Button>
          <p className="px-1 text-xs text-muted-foreground">
            {t("data_tools_clear_all_help")}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
          {backupSnapshot ? (
            <p className="text-xs text-muted-foreground">
              {t("data_tools_backup_available", { time: new Date(backupSnapshot.createdAt).toLocaleString() })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("data_tools_backup_none")}
            </p>
          )}
        </CardContent>
      </Card>
      {confirmAction ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold">
              {confirmAction === "resetEditor" ? t("data_tools_confirm_reset_title") : null}
              {confirmAction === "clearCurrentRoute" ? t("data_tools_confirm_current_title") : null}
              {confirmAction === "clearAllData" ? t("data_tools_confirm_all_title") : null}
            </h3>
            {confirmAction === "resetEditor" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("data_tools_confirm_reset_desc")}
              </p>
            ) : null}
            {confirmAction === "clearCurrentRoute" ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("data_tools_confirm_current_desc", { slug: currentSlug })}
                </p>
                <div className="mt-4 space-y-2">
                  <label htmlFor="clear-current-confirm" className="text-xs text-muted-foreground">
                    {t("data_tools_type_clear_current", { slug: currentSlug })}
                  </label>
                  <Input
                    id="clear-current-confirm"
                    value={clearCurrentConfirmText}
                    onChange={(event) => setClearCurrentConfirmText(event.target.value)}
                    placeholder={clearCurrentExpectedText}
                  />
                </div>
              </>
            ) : null}
            {confirmAction === "clearAllData" ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("data_tools_confirm_all_desc")}
                </p>
                <div className="mt-4 space-y-2">
                  <label htmlFor="strong-confirm" className="text-xs text-muted-foreground">
                    {t("data_tools_type_clear_all")}
                  </label>
                  <Input
                    id="strong-confirm"
                    value={strongConfirmText}
                    onChange={(event) => setStrongConfirmText(event.target.value)}
                    placeholder={STRONG_CONFIRM_TEXT}
                  />
                </div>
              </>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmAction(null);
                  setStrongConfirmText("");
                  setClearCurrentConfirmText("");
                  setConfirmPinInput("");
                }}
              >
                {t("data_tools_cancel")}
              </Button>
              {confirmAction === "resetEditor" ? (
                <Button variant="destructive" onClick={handleConfirmResetEditor}>
                  {t("data_tools_confirm_reset")}
                </Button>
              ) : null}
              {confirmAction === "clearCurrentRoute" ? (
                <Button
                  variant="destructive"
                  onClick={handleConfirmClearCurrentRoute}
                  disabled={clearCurrentConfirmText !== clearCurrentExpectedText || !isPinValid}
                >
                  {t("data_tools_confirm_current")}
                </Button>
              ) : null}
              {confirmAction === "clearAllData" ? (
                <Button
                  variant="destructive"
                  onClick={handleConfirmClearAllData}
                  disabled={strongConfirmText !== STRONG_CONFIRM_TEXT || !isPinValid}
                >
                  {t("data_tools_confirm_all")}
                </Button>
              ) : null}
            </div>
            {isPinRequiredForConfirm ? (
              <div className="mt-3 space-y-2">
                <label htmlFor="confirm-pin" className="text-xs text-muted-foreground">
                  {t("data_tools_pin_required")}
                </label>
                <Input
                  id="confirm-pin"
                  type="password"
                  value={confirmPinInput}
                  onChange={(event) => setConfirmPinInput(event.target.value)}
                  placeholder={t("data_tools_pin_placeholder")}
                />
              </div>
            ) : null}
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
