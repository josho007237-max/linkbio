"use client";

import Link from "next/link";
import { ExternalLink, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AnalyticsSummaryCard } from "@/components/admin/analytics-summary-card";
import { DataToolsCard } from "@/components/admin/data-tools-card";
import { SavedProfilesManagerCard } from "@/components/admin/saved-profiles-manager-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BuilderData } from "@/features/builder/types";
import { useI18n } from "@/i18n/use-i18n";
import { PublicPageListItem } from "@/lib/public-pages/public-pages-client";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  currentSlug: string;
  isSwitchingWorkspace?: boolean;
  onSwitchWorkspace?: (slug: string, options?: { fallbackData?: BuilderData; markUnsaved?: boolean }) => Promise<"remote" | "fallback">;
  savedProfiles?: PublicPageListItem[];
  onRefreshSavedPages?: () => Promise<PublicPageListItem[] | null>;
};

export const AdminSidebar = ({
  currentSlug,
  isSwitchingWorkspace = false,
  onSwitchWorkspace,
  savedProfiles,
  onRefreshSavedPages,
}: AdminSidebarProps) => (
  <AdminSidebarContent
    currentSlug={currentSlug}
    isSwitchingWorkspace={isSwitchingWorkspace}
    onSwitchWorkspace={onSwitchWorkspace}
    savedProfiles={savedProfiles}
    onRefreshSavedPages={onRefreshSavedPages}
  />
);

const AdminSidebarContent = ({
  currentSlug,
  isSwitchingWorkspace = false,
  onSwitchWorkspace,
  savedProfiles,
  onRefreshSavedPages,
}: AdminSidebarProps) => {
  const { t } = useI18n();
  const SECTION_ITEMS = useMemo(
    () => [
      { id: "header", label: t("sidebar_section_header") },
      { id: "wallpaper", label: t("sidebar_section_wallpaper") },
      { id: "text", label: t("sidebar_section_text") },
      { id: "buttons", label: t("sidebar_section_buttons") },
      { id: "social-icons", label: t("sidebar_section_social") },
      { id: "links", label: t("sidebar_section_links") },
    ],
    [t],
  );
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(SECTION_ITEMS[0].id);
  const publicPath = `/${currentSlug}`;
  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return publicPath;
    }
    return `${window.location.origin}${publicPath}`;
  }, [publicPath]);

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => {
    const setActiveFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) {
        return;
      }

      if (SECTION_ITEMS.some((item) => item.id === hash)) {
        setActiveSection(hash);
      }
    };

    const hashFrameId = window.requestAnimationFrame(setActiveFromHash);

    const observedSections = SECTION_ITEMS.map((item) =>
      document.getElementById(item.id),
    ).filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = intersecting[0];
        if (topEntry) {
          setActiveSection(topEntry.target.id);
        }
      },
      {
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-18% 0px -58% 0px",
      },
    );

    observedSections.forEach((section) => observer.observe(section));
    window.addEventListener("hashchange", setActiveFromHash);

    return () => {
      window.cancelAnimationFrame(hashFrameId);
      observer.disconnect();
      window.removeEventListener("hashchange", setActiveFromHash);
    };
  }, [SECTION_ITEMS]);

  return (
    <aside className="rounded-2xl border border-border/60 bg-gradient-to-b from-background/95 to-muted/35 p-4 shadow-sm sm:p-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("sidebar_brand_builder")}</p>
        <h1 className="text-2xl font-semibold">{t("sidebar_page_editor")}</h1>
        <Badge variant="secondary" className="rounded-full">
          {t("sidebar_live_preview")}
        </Badge>
      </div>

      <Separator className="my-4" />

      <nav className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-2">
        {SECTION_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition",
              activeSection === item.id
                ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <Separator className="my-4" />

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t("sidebar_public_route")}</p>
        <Link className="text-foreground underline underline-offset-4" href={publicPath}>
          {publicPath}
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        <Button className="w-full justify-start" variant="secondary" onClick={handleCopy}>
          <Link2 className="size-4" />
          {copied ? t("sidebar_copied") : t("sidebar_copy_public_link")}
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          onClick={() => window.open(publicPath, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="size-4" />
          {t("sidebar_open_public_page")}
        </Button>
      </div>

      <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
        <SavedProfilesManagerCard
          currentSlug={currentSlug}
          isSwitchingWorkspace={isSwitchingWorkspace}
          onSwitchWorkspace={onSwitchWorkspace}
          savedProfiles={savedProfiles}
          onRefreshSavedPages={onRefreshSavedPages}
        />
        <AnalyticsSummaryCard currentSlug={currentSlug} />
        <DataToolsCard currentSlug={currentSlug} />
      </div>
    </aside>
  );
};
