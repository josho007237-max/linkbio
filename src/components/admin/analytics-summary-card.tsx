"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/use-i18n";
import { getClickSummary, type ClickSummary } from "@/lib/local-storage/analytics-storage";
import { toProfileSlug } from "@/lib/local-storage/profile-storage";

type AnalyticsSummaryCardProps = {
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

export const AnalyticsSummaryCard = ({ username }: AnalyticsSummaryCardProps) => {
  const { t } = useI18n();
  const slug = useMemo(() => toProfileSlug(username), [username]);
  const [isMounted, setIsMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const mountFrameId = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });
    const onStorage = () => setRefreshKey((value) => value + 1);
    window.addEventListener("storage", onStorage);
    const intervalId = window.setInterval(onStorage, 3000);

    return () => {
      window.cancelAnimationFrame(mountFrameId);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  const summary = useMemo<ClickSummary>(() => {
    if (!isMounted) {
      return EMPTY_SUMMARY;
    }
    void refreshKey;
    return getClickSummary(slug);
  }, [isMounted, refreshKey, slug]);

  const data = summary ?? EMPTY_SUMMARY;

  return (
    <Card className="border-border/70 bg-muted/35 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("analytics_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("analytics_total_views")}</span>
          <span className="font-semibold">{data.totalViews}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("analytics_total_modal_opens")}</span>
          <span className="font-semibold">{data.totalModalOpens}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("analytics_total_cta_clicks")}</span>
          <span className="font-semibold">{data.totalCtaClicks}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("analytics_total_code_copies")}</span>
          <span className="font-semibold">{data.totalCodeCopies}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("analytics_last_7_days")}</span>
          <span className="font-semibold">{data.clicksLast7Days}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("analytics_last_30_days")}</span>
          <span className="font-semibold">{data.clicksLast30Days}</span>
        </div>
      </CardContent>
    </Card>
  );
};
