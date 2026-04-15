"use client";

import { useEffect, useMemo, useState } from "react";

import { PublicProfile } from "@/components/public/public-profile";
import { BuilderData } from "@/features/builder/types";
import { useI18n } from "@/i18n/use-i18n";
import {
  getClickSummary,
  recordCodeCopy,
  recordDiscountModalOpen,
  recordProfileView,
  recordLinkClick,
  type ClickSummary,
} from "@/lib/local-storage/analytics-storage";
import {
  getProfileWithFallback,
  toProfileSlug,
} from "@/lib/local-storage/profile-storage";

type PublicProfilePageClientProps = {
  username: string;
};

const EMPTY_SUMMARY: ClickSummary = {
  totalClicks: 0,
  clicksLast7Days: 0,
  clicksLast30Days: 0,
  totalViews: 0,
  totalModalOpens: 0,
  totalCtaClicks: 0,
  totalCodeCopies: 0,
};

export const PublicProfilePageClient = ({
  username,
}: PublicProfilePageClientProps) => {
  const { language, setLanguage, t } = useI18n();
  const slug = useMemo(() => toProfileSlug(username), [username]);
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<BuilderData | null>(null);
  const [clickSummary, setClickSummary] = useState<ClickSummary>(EMPTY_SUMMARY);

  useEffect(() => {
    let canceled = false;
    const frameId = window.requestAnimationFrame(() => {
      if (canceled) {
        return;
      }
      const profileData = getProfileWithFallback(slug);
      if (profileData) {
        recordProfileView(slug);
      }
      setProfile(profileData);
      setClickSummary(getClickSummary(slug));
      setMounted(true);
    });

    return () => {
      canceled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [slug]);

  const handlePublicLinkClick = (
    linkId: string,
    eventType: "cta" | "copy" | "modal_open" = "cta",
  ) => {
    if (eventType === "copy") {
      recordCodeCopy(slug, linkId);
    } else if (eventType === "modal_open") {
      recordDiscountModalOpen(slug, linkId);
    } else {
      recordLinkClick(slug, linkId);
    }
    setClickSummary(getClickSummary(slug));
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8eefc,_transparent_42%),linear-gradient(to_bottom,_var(--background),_var(--muted))] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
          <div className="h-24 animate-pulse rounded-2xl border bg-card/80" />
          <div className="mx-auto h-[760px] w-full max-w-[390px] animate-pulse rounded-[40px] border-8 border-zinc-900 bg-zinc-900/60" />
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8eefc,_transparent_40%),linear-gradient(to_bottom,_var(--background),_var(--muted))] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl rounded-3xl border bg-card/95 p-8 text-center shadow-sm backdrop-blur">
          <div className="mb-4 flex justify-end">
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 p-1">
              <span className="px-1 text-[10px] text-muted-foreground">{t("language_switch_label")}</span>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  language === "en" ? "bg-primary/15 text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("lang_en")}
              </button>
              <button
                type="button"
                onClick={() => setLanguage("th")}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  language === "th" ? "bg-primary/15 text-foreground" : "text-muted-foreground"
                }`}
              >
                {t("lang_th")}
              </button>
            </div>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {t("public_missing_title")}
          </p>
          <h1 className="mt-3 text-2xl font-semibold">{t("public_missing_heading")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("public_missing_desc", { slug })}
          </p>
        </div>
      </main>
    );
  }

  return (
    <PublicProfile
      profile={profile}
      clickSummary={clickSummary}
      onPublicLinkClick={handlePublicLinkClick}
    />
  );
};
