"use client";

import { Save } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "saving" | "unsaved";

type SaveStatusBarProps = {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onSaveNow: () => void;
  isSwitchingWorkspace?: boolean;
};

export const SaveStatusBar = ({
  status,
  lastSavedAt,
  onSaveNow,
  isSwitchingWorkspace = false,
}: SaveStatusBarProps) => {
  const { language, setLanguage, t } = useI18n();
  const formattedLastSaved = useMemo(() => {
    if (!lastSavedAt) {
      return t("save_status_not_saved_yet");
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(lastSavedAt);
  }, [lastSavedAt, t]);

  const statusLabel = useMemo<Record<SaveStatus, string>>(
    () => ({
      saved: t("save_status_saved"),
      saving: t("save_status_saving"),
      unsaved: t("save_status_unsaved"),
    }),
    [t],
  );

  return (
    <div className="mb-4 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("save_status_title")}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                status === "saved" &&
                  "border-emerald-300 bg-emerald-100/70 text-emerald-900",
                status === "saving" &&
                  "border-amber-300 bg-amber-100/70 text-amber-900",
                status === "unsaved" &&
                  "border-orange-300 bg-orange-100/70 text-orange-900",
              )}
            >
              {statusLabel[status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("save_status_last_saved")}: {formattedLastSaved}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-background/70 p-1">
            <span className="px-1 py-1 text-[10px] text-muted-foreground">{t("language_switch_label")}</span>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition",
                language === "en"
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t("lang_en")}
            </button>
            <button
              type="button"
              onClick={() => setLanguage("th")}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition",
                language === "th"
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t("lang_th")}
            </button>
          </div>
          <Button variant="secondary" onClick={onSaveNow} disabled={isSwitchingWorkspace}>
            <Save className="size-4" />
            {t("save_status_save_now")}
          </Button>
        </div>
      </div>
    </div>
  );
};
