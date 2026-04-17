"use client";

import { safeJsonParse } from "@/lib/json/safe-json-parse";

const ANALYTICS_KEY = "linkbio-click-analytics-v1";

type AnalyticsEventType = "view" | "modal_open" | "cta_click" | "code_copy";

type AnalyticsEvent = {
  profileSlug: string;
  linkId?: string;
  timestamp: string;
  type: AnalyticsEventType;
};

type AnalyticsStore = {
  events: AnalyticsEvent[];
};

export type ClickSummary = {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
  totalViews: number;
  totalModalOpens: number;
  totalCtaClicks: number;
  totalCodeCopies: number;
};

export type LinkClickCounts = Record<string, number>;
export type AnalyticsEventSnapshot = {
  profileSlug: string;
  linkId?: string;
  timestamp: string;
  type: AnalyticsEventType;
};

const normalizeSlug = (value: string): string => value.trim().toLowerCase();

const readStore = (): AnalyticsStore => {
  if (typeof window === "undefined") {
    return { events: [] };
  }

  try {
    const raw = window.localStorage.getItem(ANALYTICS_KEY);
    if (!raw) {
      return { events: [] };
    }

    const parsed = safeJsonParse<Partial<AnalyticsStore>>(raw, {});
    if (!Array.isArray(parsed.events)) {
      return { events: [] };
    }
    const normalizedEvents = parsed.events.flatMap((event) => {
      if (!event || typeof event !== "object") {
        return [];
      }

      const profileSlug =
        typeof event.profileSlug === "string"
          ? event.profileSlug.trim().toLowerCase()
          : "";
      const timestamp =
        typeof event.timestamp === "string" ? event.timestamp : "";
      const linkId =
        typeof event.linkId === "string" ? event.linkId : undefined;
      const type =
        event.type === "view" ||
        event.type === "modal_open" ||
        event.type === "cta_click" ||
        event.type === "code_copy"
          ? event.type
          : "cta_click";

      if (!profileSlug || !timestamp) {
        return [];
      }

      return [{ profileSlug, linkId, timestamp, type }];
    });

    return { events: normalizedEvents };
  } catch {
    return { events: [] };
  }
};

const writeStore = (store: AnalyticsStore): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serialized = JSON.stringify(store);
    if (!serialized.trim()) {
      window.localStorage.removeItem(ANALYTICS_KEY);
      return;
    }
    window.localStorage.setItem(ANALYTICS_KEY, serialized);
  } catch {
    return;
  }
};

export const removeAnalyticsForSlug = (profileSlug: string): void => {
  const normalizedSlug = normalizeSlug(profileSlug);
  const store = readStore();
  const nextEvents = store.events.filter(
    (event) => event.profileSlug !== normalizedSlug,
  );
  if (nextEvents.length === store.events.length) {
    return;
  }
  writeStore({ events: nextEvents });
};

export const clearAnalyticsStore = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ANALYTICS_KEY);
};

const recordEvent = (
  profileSlug: string,
  type: AnalyticsEventType,
  linkId?: string,
): void => {
  const store = readStore();
  store.events.push({
    profileSlug: normalizeSlug(profileSlug),
    linkId,
    timestamp: new Date().toISOString(),
    type,
  });
  writeStore(store);
};

export const getAnalyticsEventsForSlug = (
  profileSlug: string,
): AnalyticsEventSnapshot[] => {
  const normalizedSlug = normalizeSlug(profileSlug);
  return readStore().events
    .filter((event) => event.profileSlug === normalizedSlug)
    .map((event) => ({
      profileSlug: event.profileSlug,
      linkId: event.linkId,
      timestamp: event.timestamp,
      type: event.type,
    }));
};

export const replaceAnalyticsEventsForSlug = (
  profileSlug: string,
  snapshotEvents: AnalyticsEventSnapshot[],
): void => {
  const normalizedSlug = normalizeSlug(profileSlug);
  const store = readStore();
  const retainedEvents = store.events.filter(
    (event) => event.profileSlug !== normalizedSlug,
  );

  const restoredEvents = snapshotEvents.flatMap((event) => {
    if (!event || typeof event !== "object") {
      return [];
    }

    const timestamp = typeof event.timestamp === "string" ? event.timestamp : "";
    if (!timestamp) {
      return [];
    }

    if (
      event.type !== "view" &&
      event.type !== "modal_open" &&
      event.type !== "cta_click" &&
      event.type !== "code_copy"
    ) {
      return [];
    }

    return [
      {
        profileSlug: normalizedSlug,
        timestamp,
        type: event.type,
        linkId: typeof event.linkId === "string" ? event.linkId : undefined,
      } satisfies AnalyticsEvent,
    ];
  });

  writeStore({
    events: [...retainedEvents, ...restoredEvents],
  });
};

export const recordProfileView = (profileSlug: string): void => {
  recordEvent(profileSlug, "view");
};

export const recordDiscountModalOpen = (
  profileSlug: string,
  linkId: string,
): void => {
  recordEvent(profileSlug, "modal_open", linkId);
};

export const recordLinkClick = (profileSlug: string, linkId: string): void => {
  recordEvent(profileSlug, "cta_click", linkId);
};

export const recordCodeCopy = (profileSlug: string, linkId: string): void => {
  recordEvent(profileSlug, "code_copy", linkId);
};

const countEventsSince = (
  events: AnalyticsEvent[],
  type: AnalyticsEventType,
  sinceMs: number,
): number => {
  const now = Date.now();
  return events.filter((event) => {
    if (event.type !== type) {
      return false;
    }

    const eventMs = new Date(event.timestamp).getTime();
    if (Number.isNaN(eventMs)) {
      return false;
    }

    return now - eventMs <= sinceMs;
  }).length;
};

export const getClickSummary = (profileSlug: string): ClickSummary => {
  const store = readStore();
  const profileEvents = store.events.filter(
    (event) => event.profileSlug === profileSlug,
  );
  const ctaEvents = profileEvents.filter((event) => event.type === "cta_click");

  return {
    totalClicks: ctaEvents.length,
    clicksLast7Days: countEventsSince(ctaEvents, "cta_click", 7 * 24 * 60 * 60 * 1000),
    clicksLast30Days: countEventsSince(ctaEvents, "cta_click", 30 * 24 * 60 * 60 * 1000),
    totalViews: profileEvents.filter((event) => event.type === "view").length,
    totalModalOpens: profileEvents.filter((event) => event.type === "modal_open").length,
    totalCtaClicks: ctaEvents.length,
    totalCodeCopies: profileEvents.filter((event) => event.type === "code_copy").length,
  };
};

export const getPerLinkClickCounts = (profileSlug: string): LinkClickCounts => {
  const store = readStore();
  return store.events
    .filter(
      (event) =>
        event.profileSlug === profileSlug &&
        event.type === "cta_click" &&
        typeof event.linkId === "string",
    )
    .reduce<LinkClickCounts>((acc, event) => {
      const linkId = event.linkId as string;
      acc[linkId] = (acc[linkId] ?? 0) + 1;
      return acc;
    }, {});
};

export { ANALYTICS_KEY };
