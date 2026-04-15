"use client";

import { ClickSummary } from "@/lib/local-storage/analytics-storage";
import { BuilderData } from "@/features/builder/types";
import { MobilePreview } from "@/components/preview/mobile-preview";
import { useI18n } from "@/i18n/use-i18n";

type PublicProfileProps = {
  profile: BuilderData;
  clickSummary: ClickSummary;
  onPublicLinkClick: (
    linkId: string,
    eventType?: "cta" | "copy" | "modal_open",
  ) => void;
};

export const PublicProfile = ({
  profile,
  clickSummary,
  onPublicLinkClick,
}: PublicProfileProps) => {
  const { t } = useI18n();
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e4eefb,_transparent_42%),linear-gradient(to_bottom,_var(--background),_var(--muted))] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-10 lg:space-y-0">
        <div className="rounded-2xl border bg-card/95 p-5 text-center shadow-sm backdrop-blur sm:p-6 lg:sticky lg:top-8 lg:text-left">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {t("public_page_heading")}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            /{profile.header.username}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            {profile.header.tagline}
          </p>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            {t("public_page_clicks_summary", {
              total: clickSummary.totalClicks,
              d7: clickSummary.clicksLast7Days,
              d30: clickSummary.clicksLast30Days,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {t("public_page_analytics_summary", {
              views: clickSummary.totalViews,
              cta: clickSummary.totalCtaClicks,
              copies: clickSummary.totalCodeCopies,
            })}
          </p>
        </div>
        <MobilePreview
          data={profile}
          mode="public"
          onPublicLinkClick={onPublicLinkClick}
        />
      </div>
    </main>
  );
};
